from datetime import datetime, time, timedelta, timezone
from decimal import Decimal
import base64
import csv
from io import StringIO
import binascii
import hashlib
import hmac
import json
import mimetypes
import re
import secrets
from time import monotonic
from urllib.parse import urlencode
from urllib.request import urlopen

import requests as http_requests

from bson import ObjectId
from bson.decimal128 import Decimal128
from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from django.contrib.auth.password_validation import validate_password
from django.core.mail import EmailMultiAlternatives
from django.http import FileResponse, HttpResponse
from html import escape
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from pymongo import ASCENDING, DESCENDING
from pymongo.errors import DuplicateKeyError, PyMongoError
from rest_framework import status
from rest_framework.decorators import api_view, authentication_classes, parser_classes, permission_classes, throttle_classes
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .authentication import clear_auth_cookies, create_access_token, set_auth_cookies
from .mongo import ensure_indexes, get_db
from .serializers import EarningSerializer, GoalSerializer, LoginSerializer, PlatformSerializer, RegisterSerializer
from .throttles import AuthBurstThrottle, PasswordResetThrottle, RegistrationThrottle
from .utils import (
    decimal128,
    decimal_to_float,
    delete_logo,
    oid,
    save_logo,
    save_upload,
    resolve_upload_path,
    serialize_datetime,
    serialize_note,
    serialize_earning,
    serialize_platform,
    utcnow,
)


def owner_oid(request):
    return ObjectId(request.user.id)


SUPERADMIN_EMAIL = settings.SUPERADMIN_EMAIL
DUMMY_PASSWORD_HASH = make_password(secrets.token_urlsafe(32))


def is_admin_doc(doc):
    # Never infer administrator privileges from a self-registered email address.
    # Admin access is an explicit database role.
    return bool(doc and doc.get("role") == "admin")


def is_superadmin_doc(doc):
    return bool(
        doc
        and doc.get("role") == "admin"
        and SUPERADMIN_EMAIL
        and doc.get("email", "").lower() == SUPERADMIN_EMAIL
    )


def serialize_user(doc, request):
    avatar = doc.get("profile_image") or ""
    avatar_url = ""
    if avatar:
        avatar_url = f"{settings.MEDIA_URL}{avatar}".replace("//", "/")

    # If the user explicitly removed their avatar, do not fall back to the
    # Google account photo. Returning an empty URL lets the frontend render
    # /profile_logo.jpg as the intentional default avatar.
    profile_image_removed = bool(doc.get("profile_image_removed"))
    profile_image_url = "" if profile_image_removed else (avatar_url or doc.get("google_picture", ""))

    return {
        "id": str(doc["_id"]),
        "name": doc.get("name", ""),
        "email": doc.get("email", ""),
        "profile_image_url": profile_image_url,
        "role": "admin" if is_admin_doc(doc) else doc.get("role", "user"),
        "trial_ends_at": serialize_datetime(doc.get("trial_ends_at")),
        "subscription_status": doc.get("subscription_status", "trial"),
    }


def create_user_doc(name, email, password_hash="", google_picture=""):
    now = utcnow()
    return {
        "name": name[:120],
        "email": email,
        "password_hash": password_hash,
        "google_picture": google_picture,
        "auth_provider": "google" if google_picture else "password",
        "role": "user",
        "token_version": 0,
        "created_at": now,
        "updated_at": now,
        "trial_ends_at": now + timedelta(days=30),
        "subscription_status": "trial",
        "payment_method": None,
    }


def auth_success_response(doc, request, status_code=status.HTTP_200_OK):
    token, csrf_token = create_access_token(
        str(doc["_id"]),
        doc.get("email", ""),
        doc.get("token_version", 0),
    )
    response = Response(
        {"user": serialize_user(doc, request)},
        status=status_code,
    )
    set_auth_cookies(response, token, csrf_token)
    response["Cache-Control"] = "no-store, private"
    return response


def is_active_trial(value):
    if not value:
        return False
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value > utcnow()


_egp_rate_cache = {"value": None, "expires_at": 0}
_currency_rates_cache = {"value": None, "expires_at": 0}


def current_egp_per_usd():
    now = monotonic()
    if _egp_rate_cache["value"] is not None and now < _egp_rate_cache["expires_at"]:
        return _egp_rate_cache["value"]

    try:
        with urlopen(settings.EGP_RATE_API_URL, timeout=3) as response:
            payload = json.load(response)
        rate = Decimal(str(payload["rates"]["EGP"]))
        if rate <= 0:
            raise ValueError("Invalid EGP exchange rate")
        _egp_rate_cache.update({"value": rate, "expires_at": now + settings.EGP_RATE_CACHE_SECONDS})
        return rate
    except (OSError, KeyError, TypeError, ValueError, json.JSONDecodeError):
        return settings.EGP_PER_USD


def current_currency_rates():
    now = monotonic()
    if _currency_rates_cache["value"] is not None and now < _currency_rates_cache["expires_at"]:
        return _currency_rates_cache["value"]
    try:
        with urlopen(settings.EGP_RATE_API_URL, timeout=3) as response:
            payload = json.load(response)
        rates = {"USD": Decimal("1")}
        rates.update({code.upper(): Decimal(str(value)) for code, value in payload["rates"].items() if Decimal(str(value)) > 0})
        rates.setdefault("EGP", settings.EGP_PER_USD)
        _currency_rates_cache.update({"value": rates, "expires_at": now + settings.EGP_RATE_CACHE_SECONDS})
        return rates
    except (OSError, KeyError, TypeError, ValueError, json.JSONDecodeError):
        return {"USD": Decimal("1"), "EGP": settings.EGP_PER_USD}


def dashboard_currency_query(currency):
    return {"currency": {"$exists": True}}


def dashboard_amount_expression(currency, rates):
    target_rate = rates.get(currency)
    if not target_rate:
        return "$amount"
    branches = [
        {
            "case": {"$eq": ["$currency", source_currency]},
            "then": {"$multiply": ["$amount", Decimal128(str(target_rate / source_rate))]},
        }
        for source_currency, source_rate in rates.items()
    ]
    return {"$switch": {"branches": branches, "default": "$amount"}}

def dashboard_net_expression(currency, rates):
    target_rate = rates.get(currency)
    base_net = {
        "$subtract": [
            "$amount",
            {
                "$add": [
                    {"$ifNull": ["$platform_fee", Decimal128("0")]},
                    {"$ifNull": ["$payment_fee", Decimal128("0")]},
                ]
            },
        ]
    }

    if not target_rate:
        return base_net

    branches = [
        {
            "case": {"$eq": ["$currency", source_currency]},
            "then": {
                "$multiply": [
                    base_net,
                    Decimal128(str(target_rate / source_rate)),
                ]
            },
        }
        for source_currency, source_rate in rates.items()
    ]

    return {"$switch": {"branches": branches, "default": base_net}}




@api_view(["GET"])
@permission_classes([AllowAny])
@authentication_classes([])
def health(request):
    try:
        get_db().command("ping")
    except Exception:
        return Response({"status": "unavailable"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
    return Response({"status": "ok"})


@api_view(["POST"])
@permission_classes([AllowAny])
@authentication_classes([])
@throttle_classes([RegistrationThrottle])
def register(request):
    serializer = RegisterSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data
    db = get_db()
    ensure_indexes()
    email = data["email"].strip().lower()

    user_doc = create_user_doc(
        data["name"].strip(),
        email,
        make_password(data["password"]),
    )

    try:
        result = db.users.insert_one(user_doc)
    except DuplicateKeyError:
        return Response(
            {"detail": "An account with this email already exists."},
            status=status.HTTP_409_CONFLICT,
        )

    user_doc["_id"] = result.inserted_id

    for admin_doc in db.users.find({"role": "admin"}, {"_id": 1}):
        create_notification(
            "user",
            "New user registered",
            f"{email} created a Revnivo account.",
            admin_doc["_id"],
        )

    return auth_success_response(
        user_doc,
        request,
        status.HTTP_201_CREATED,
    )

@api_view(["POST"])
@permission_classes([AllowAny])
@authentication_classes([])
@throttle_classes([AuthBurstThrottle])
def login(request):
    serializer = LoginSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    email = serializer.validated_data["email"].strip().lower()
    doc = get_db().users.find_one({"email": email})
    password_hash = doc.get("password_hash") if doc and doc.get("password_hash") else DUMMY_PASSWORD_HASH
    password_ok = check_password(
        serializer.validated_data["password"],
        password_hash,
    )

    if not doc or not password_ok:
        return Response(
            {"detail": "Invalid email or password."},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    return auth_success_response(doc, request)

def send_password_reset_email(email, code):
    """
    Send a branded Revnivo password-reset OTP email.

    A plain-text fallback is included for email clients that do not render HTML.
    """
    minutes = settings.PASSWORD_RESET_OTP_MINUTES
    safe_email = escape(email)

    subject = "Your Revnivo password reset code"

    text_content = (
        "Revnivo password reset\n\n"
        f"We received a request to reset the password for {email}.\n\n"
        f"Your verification code is: {code}\n\n"
        f"This code expires in {minutes} minutes.\n\n"
        "If you did not request this password reset, you can safely ignore this email.\n\n"
        "For your security, never share this code with anyone."
    )

    html_content = f"""
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta name="color-scheme" content="light">
        <meta name="supported-color-schemes" content="light">
        <title>Revnivo Password Reset</title>
      </head>

      <body style="margin:0;padding:0;background-color:#f4f7fb;font-family:Arial,Helvetica,sans-serif;color:#111827;">
        <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
          Your Revnivo verification code is {code}. It expires in {minutes} minutes.
        </div>

        <table
          role="presentation"
          width="100%"
          cellpadding="0"
          cellspacing="0"
          border="0"
          style="width:100%;margin:0;padding:0;background-color:#f4f7fb;"
        >
          <tr>
            <td align="center" style="padding:36px 16px;">
              <table
                role="presentation"
                width="100%"
                cellpadding="0"
                cellspacing="0"
                border="0"
                style="
                  width:100%;
                  max-width:600px;
                  background-color:#ffffff;
                  border:1px solid #e7edf5;
                  border-radius:22px;
                  overflow:hidden;
                  box-shadow:0 18px 55px rgba(15,23,42,0.08);
                "
              >
                <!-- Header -->
                <tr>
                  <td
                    align="center"
                    style="
                      padding:34px 32px 30px;
                      background-color:#006fee;
                      background-image:linear-gradient(135deg,#006fee 0%,#1688ff 100%);
                    "
                  >
                    <div
                      style="
                        display:inline-block;
                        margin:0;
                        font-size:30px;
                        line-height:36px;
                        font-weight:800;
                        letter-spacing:-0.8px;
                        color:#ffffff;
                      "
                    >
                      Revnivo
                    </div>

                    <div
                      style="
                        margin-top:8px;
                        font-size:13px;
                        line-height:20px;
                        font-weight:600;
                        letter-spacing:0.3px;
                        color:#dcecff;
                      "
                    >
                      Secure password recovery
                    </div>
                  </td>
                </tr>

                <!-- Content -->
                <tr>
                  <td style="padding:36px 34px 32px;">
                    <h1
                      style="
                        margin:0;
                        font-size:28px;
                        line-height:36px;
                        font-weight:800;
                        letter-spacing:-0.6px;
                        color:#111827;
                      "
                    >
                      Reset your password
                    </h1>

                    <p
                      style="
                        margin:12px 0 0;
                        font-size:15px;
                        line-height:24px;
                        color:#667085;
                      "
                    >
                      We received a request to reset the password for your Revnivo account.
                    </p>

                    <table
                      role="presentation"
                      width="100%"
                      cellpadding="0"
                      cellspacing="0"
                      border="0"
                      style="margin-top:20px;"
                    >
                      <tr>
                        <td
                          style="
                            padding:13px 15px;
                            background-color:#f8fafc;
                            border:1px solid #e5eaf1;
                            border-radius:12px;
                            font-size:13px;
                            line-height:20px;
                            color:#667085;
                          "
                        >
                          Account:
                          <span style="font-weight:700;color:#1f2937;">
                            {safe_email}
                          </span>
                        </td>
                      </tr>
                    </table>

                    <p
                      style="
                        margin:26px 0 10px;
                        font-size:14px;
                        line-height:22px;
                        font-weight:600;
                        color:#344054;
                      "
                    >
                      Use this verification code to continue:
                    </p>

                    <!-- OTP -->
                    <table
                      role="presentation"
                      width="100%"
                      cellpadding="0"
                      cellspacing="0"
                      border="0"
                    >
                      <tr>
                        <td
                          align="center"
                          style="
                            padding:25px 18px;
                            background-color:#f3f8ff;
                            border:1px solid #cfe3ff;
                            border-radius:16px;
                          "
                        >
                          <div
                            style="
                              font-family:'Courier New',Courier,monospace;
                              font-size:38px;
                              line-height:44px;
                              font-weight:800;
                              letter-spacing:9px;
                              color:#006fee;
                              white-space:nowrap;
                            "
                          >
                            {code}
                          </div>

                          <div
                            style="
                              margin-top:10px;
                              font-size:12px;
                              line-height:18px;
                              color:#667085;
                            "
                          >
                            Expires in
                            <strong style="color:#344054;">
                              {minutes} minutes
                            </strong>
                          </div>
                        </td>
                      </tr>
                    </table>

                    <!-- Security notice -->
                    <table
                      role="presentation"
                      width="100%"
                      cellpadding="0"
                      cellspacing="0"
                      border="0"
                      style="margin-top:24px;"
                    >
                      <tr>
                        <td
                          style="
                            padding:16px 18px;
                            background-color:#fffaf0;
                            border:1px solid #f5dfb3;
                            border-radius:14px;
                          "
                        >
                          <div
                            style="
                              font-size:13px;
                              line-height:20px;
                              font-weight:700;
                              color:#8a5a00;
                            "
                          >
                            Security reminder
                          </div>

                          <div
                            style="
                              margin-top:5px;
                              font-size:13px;
                              line-height:21px;
                              color:#7a6540;
                            "
                          >
                            Never share this verification code with anyone.
                            Revnivo will never ask you for this code by email,
                            chat, or phone.
                          </div>
                        </td>
                      </tr>
                    </table>

                    <p
                      style="
                        margin:24px 0 0;
                        font-size:13px;
                        line-height:21px;
                        color:#98a2b3;
                      "
                    >
                      If you did not request a password reset, you can safely ignore
                      this email. Your current password will remain unchanged.
                    </p>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td
                    align="center"
                    style="
                      padding:22px 28px;
                      background-color:#f9fafb;
                      border-top:1px solid #edf0f4;
                    "
                  >
                    <div
                      style="
                        font-size:13px;
                        line-height:20px;
                        font-weight:700;
                        color:#344054;
                      "
                    >
                      Revnivo
                    </div>

                    <div
                      style="
                        margin-top:4px;
                        font-size:11px;
                        line-height:18px;
                        color:#98a2b3;
                      "
                    >
                      Secure access to your income workspace
                    </div>

                    <div
                      style="
                        margin-top:8px;
                        font-size:10px;
                        line-height:16px;
                        color:#b0b8c4;
                      "
                    >
                      This is an automated security email. Please do not reply.
                    </div>
                  </td>
                </tr>
              </table>

              <div
                style="
                  max-width:600px;
                  margin-top:16px;
                  padding:0 12px;
                  text-align:center;
                  font-size:11px;
                  line-height:17px;
                  color:#98a2b3;
                "
              >
                © Revnivo. All rights reserved.
              </div>
            </td>
          </tr>
        </table>
      </body>
    </html>
    """

    message = EmailMultiAlternatives(
        subject=subject,
        body=text_content,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[email],
    )
    message.attach_alternative(html_content, "text/html")
    message.send(fail_silently=False)


@api_view(["POST"])
@permission_classes([AllowAny])
@authentication_classes([])
@throttle_classes([PasswordResetThrottle])
def forgot_password(request):
    email = str(request.data.get("email", "")).strip().lower()
    if not email:
        return Response({"detail": "Email is required."}, status=status.HTTP_400_BAD_REQUEST)
    if not settings.EMAIL_HOST:
        return Response({"detail": "Email delivery is not configured. Set EMAIL_HOST and restart the backend."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

    db = get_db()
    ensure_indexes()
    user = db.users.find_one({"email": email}, {"_id": 1})
    if not user:
        # Keep the response identical to avoid confirming registered email addresses.
        return Response({"detail": "If this email has an account, a verification code has been sent."})

    now = utcnow()
    existing = db.password_reset_otps.find_one({"email": email}, {"created_at": 1})
    created_at = existing.get("created_at") if existing else None
    if created_at and created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
    if created_at and (now - created_at).total_seconds() < settings.PASSWORD_RESET_COOLDOWN_SECONDS:
        return Response({"detail": "If this email has an account, a verification code has been sent."})

    code = f"{secrets.randbelow(1_000_000):06d}"
    reset = {
        "email": email,
        "code_hash": make_password(code),
        "attempts": 0,
        "created_at": now,
        "expires_at": now + timedelta(minutes=settings.PASSWORD_RESET_OTP_MINUTES),
    }
    db.password_reset_otps.replace_one({"email": email}, reset, upsert=True)

    try:
        send_password_reset_email(email, code)
    except Exception:
        db.password_reset_otps.delete_one({"email": email, "code_hash": reset["code_hash"]})
        return Response({"detail": "Unable to send the verification code. Please try again later."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

    return Response({"detail": "If this email has an account, a verification code has been sent."})


@api_view(["POST"])
@permission_classes([AllowAny])
@authentication_classes([])
@throttle_classes([PasswordResetThrottle])
def reset_password(request):
    email = str(request.data.get("email", "")).strip().lower()
    code = str(request.data.get("code", "")).strip()
    password = str(request.data.get("password", ""))
    if not email or not code or not password:
        return Response({"detail": "Email, verification code, and new password are required."}, status=status.HTTP_400_BAD_REQUEST)
    if len(code) != 6 or not code.isdigit():
        return Response({"detail": "Enter the 6-digit verification code."}, status=status.HTTP_400_BAD_REQUEST)
    try:
        validate_password(password)
    except Exception as exc:
        messages = getattr(exc, "messages", None) or [str(exc)]
        return Response(
            {"detail": " ".join(messages)},
            status=status.HTTP_400_BAD_REQUEST,
        )

    db = get_db()
    reset = db.password_reset_otps.find_one({"email": email})
    if not reset or reset.get("expires_at", now := utcnow()) <= now:
        db.password_reset_otps.delete_one({"email": email})
        return Response({"detail": "This verification code has expired. Request a new one."}, status=status.HTTP_400_BAD_REQUEST)
    if reset.get("attempts", 0) >= 5:
        db.password_reset_otps.delete_one({"email": email})
        return Response({"detail": "Too many incorrect attempts. Request a new code."}, status=status.HTTP_400_BAD_REQUEST)
    if not check_password(code, reset["code_hash"]):
        db.password_reset_otps.update_one({"_id": reset["_id"]}, {"$inc": {"attempts": 1}})
        return Response({"detail": "Incorrect verification code."}, status=status.HTTP_400_BAD_REQUEST)

    result = db.users.update_one(
        {"email": email},
        {
            "$set": {
                "password_hash": make_password(password),
                "auth_provider": "password",
                "updated_at": utcnow(),
            },
            "$inc": {"token_version": 1},
        },
    )
    db.password_reset_otps.delete_one({"_id": reset["_id"]})
    if not result.matched_count:
        return Response({"detail": "Unable to reset this password."}, status=status.HTTP_400_BAD_REQUEST)
    return Response({"detail": "Password reset successfully."})


@api_view(["POST"])
@permission_classes([AllowAny])
@authentication_classes([])
@throttle_classes([AuthBurstThrottle])
def google_login(request):
    credential = request.data.get("credential")
    if not settings.GOOGLE_CLIENT_ID:
        return Response({"detail": "Google sign-in is not configured."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
    if not credential:
        return Response({"detail": "Google credential is required."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        google_user = id_token.verify_oauth2_token(
            credential,
            google_requests.Request(),
            settings.GOOGLE_CLIENT_ID,
            clock_skew_in_seconds=300,
        )
    except ValueError as exc:
        detail = "Invalid Google credential."
        if settings.DEBUG:
            try:
                payload = json.loads(base64.urlsafe_b64decode(credential.split(".")[1] + "=="))
                if payload.get("aud") != settings.GOOGLE_CLIENT_ID:
                    detail = "Google credential audience does not match GOOGLE_CLIENT_ID. Restart both servers and verify the same Web client ID is used."
                elif payload.get("iss") not in ("accounts.google.com", "https://accounts.google.com"):
                    detail = "Google credential has an invalid issuer."
                elif payload.get("exp", 0) <= int(datetime.now(timezone.utc).timestamp()):
                    detail = "Google credential has expired. Refresh the page and try again."
                elif payload.get("iat", 0) > int(datetime.now(timezone.utc).timestamp()) + 300:
                    detail = "Google credential starts in the future. Check your computer date and time."
                else:
                    detail = f"Google credential rejected: {type(exc).__name__}. Restart the backend and try again."
            except (IndexError, TypeError, ValueError, binascii.Error, json.JSONDecodeError):
                detail = "Google credential is malformed. Refresh the page and try again."
        return Response({"detail": detail}, status=status.HTTP_401_UNAUTHORIZED)

    email = google_user.get("email", "").strip().lower()
    if not email or not google_user.get("email_verified"):
        return Response({"detail": "Google account email is not verified."}, status=status.HTTP_401_UNAUTHORIZED)

    db = get_db()
    doc = db.users.find_one({"email": email})
    if not doc:
        name = google_user.get("name") or email.split("@", 1)[0]
        try:
            new_doc = create_user_doc(name, email, google_picture=google_user.get("picture", ""))
            result = db.users.insert_one(new_doc)
            doc = {"_id": result.inserted_id, **new_doc}
        except DuplicateKeyError:
            doc = db.users.find_one({"email": email})
        for admin_doc in db.users.find({"role": "admin"}, {"_id": 1}):
            create_notification(
                "user",
                "New user registered",
                f"{email} created a Revnivo account.",
                admin_doc["_id"],
            )

    if google_user.get("picture") and doc.get("google_picture") != google_user["picture"]:
        db.users.update_one({"_id": doc["_id"]}, {"$set": {"google_picture": google_user["picture"]}})
        doc["google_picture"] = google_user["picture"]

    return auth_success_response(doc, request)


@api_view(["POST"])
def logout(request):
    db = get_db()
    owner = owner_oid(request)

    # Revoke every token minted before logout. This also protects against a
    # stolen bearer/cookie token continuing to work after the user signs out.
    db.users.update_one(
        {"_id": owner},
        {"$inc": {"token_version": 1}, "$set": {"last_seen": None}},
    )

    response = Response({"status": "logged_out"})
    clear_auth_cookies(response)
    response["Cache-Control"] = "no-store, private"
    return response


@api_view(["GET"])
def me(request):
    doc = get_db().users.find_one({"_id": ObjectId(request.user.id)})
    return Response(serialize_user(doc, request))


@api_view(["PATCH"])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def profile(request):
    db = get_db()
    owner = owner_oid(request)
    doc = db.users.find_one({"_id": owner})
    if not doc:
        return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)
    updates = {"updated_at": utcnow()}
    if "name" in request.data:
        name = str(request.data["name"]).strip()
        if not name:
            return Response({"detail": "Name is required."}, status=status.HTTP_400_BAD_REQUEST)
        updates["name"] = name[:120]
    if request.FILES.get("profile_image"):
        if doc.get("profile_image"):
            delete_logo(doc["profile_image"])
        updates["profile_image"] = save_logo(request.FILES["profile_image"], "profiles")
        updates["profile_image_removed"] = False
    elif str(request.data.get("remove_profile_image", "")).lower() == "true":
        if doc.get("profile_image"):
            delete_logo(doc["profile_image"])
        updates["profile_image"] = ""
        updates["profile_image_removed"] = True
    db.users.update_one({"_id": owner}, {"$set": updates})
    doc.update(updates)
    return Response(serialize_user(doc, request))


def require_admin(request):
    doc = get_db().users.find_one({"_id": owner_oid(request)})
    return doc if is_admin_doc(doc) else None


def create_notification(kind, title, message, owner_id=None, chat_user_id=None):
    now = utcnow()
    notification = {"kind": kind, "title": title, "message": message, "owner_id": owner_id, "read": False, "created_at": now}
    if chat_user_id:
        notification["chat_user_id"] = str(chat_user_id)
    get_db().notifications.insert_one(notification)


@api_view(["GET", "PATCH", "DELETE"])
def admin_users(request):
    if not require_admin(request):
        return Response({"detail": "Admin access required."}, status=status.HTTP_403_FORBIDDEN)
    db = get_db()
    if request.method in ("PATCH", "DELETE"):
        user_id = oid(request.data.get("id") or request.data.get("user_id"))
        if not user_id:
            return Response({"detail": "Invalid user id."}, status=status.HTTP_400_BAD_REQUEST)
        if user_id == owner_oid(request):
            return Response({"detail": "You cannot change or delete your own admin account."}, status=status.HTTP_400_BAD_REQUEST)
        target = db.users.find_one({"_id": user_id})
        if is_superadmin_doc(target):
            return Response({"detail": "The super admin account cannot be changed or deleted."}, status=status.HTTP_403_FORBIDDEN)
        if request.method == "DELETE":
            db.users.delete_one({"_id": user_id})
            return Response(status=status.HTTP_204_NO_CONTENT)
        role = request.data.get("role")
        if role not in ("admin", "user"):
            return Response({"detail": "Role must be admin or user."}, status=status.HTTP_400_BAD_REQUEST)
        db.users.update_one({"_id": user_id}, {"$set": {"role": role}})
    docs = list(db.users.find({}).sort("created_at", DESCENDING))
    return Response({
        "stats": {
            "total": len(docs),
            "admins": sum(1 for doc in docs if is_admin_doc(doc)),
            "users": sum(1 for doc in docs if not is_admin_doc(doc)),
            "active_trials": sum(1 for doc in docs if is_active_trial(doc.get("trial_ends_at"))),
        },
        "users": [
            {
                **serialize_user(doc, request),
                "created_at": serialize_datetime(doc.get("created_at")),
            }
            for doc in docs
        ],
    })


def _paymob_configured():
    return all([
        settings.PAYMOB_SECRET_KEY,
        settings.PAYMOB_PUBLIC_KEY,
        settings.PAYMOB_HMAC_SECRET,
        settings.PAYMOB_INTEGRATION_ID_CARD,
    ])


def _payment_method_code(value):
    code = re.sub(r"[^a-z0-9]+", "-", str(value or "").strip().lower()).strip("-")
    return code[:60]


def _ensure_default_payment_methods(db):
    initialized = db.settings.find_one({"key": "payment_methods_initialized"})
    if initialized:
        return

    if db.payment_methods.count_documents({}) == 0:
        now = utcnow()
        defaults = [
            {
                "code": "paymob",
                "name": "Paymob",
                "provider": "paymob",
                "description": "Cards and supported Paymob payment methods through secure Unified Checkout.",
                "active": True,
                "sort_order": 10,
                "created_at": now,
                "updated_at": now,
            },
            {
                "code": "fawry",
                "name": "Fawry",
                "provider": "fawry",
                "description": "Pay through Fawry channels and supported local methods.",
                "active": True,
                "sort_order": 20,
                "created_at": now,
                "updated_at": now,
            },
            {
                "code": "paypal",
                "name": "PayPal",
                "provider": "paypal",
                "description": "Pay with a PayPal account or supported PayPal checkout.",
                "active": True,
                "sort_order": 30,
                "created_at": now,
                "updated_at": now,
            },
            {
                "code": "kashier",
                "name": "Kashier",
                "provider": "kashier",
                "description": "Online card and digital checkout.",
                "active": True,
                "sort_order": 40,
                "created_at": now,
                "updated_at": now,
            },
        ]
        db.payment_methods.insert_many(defaults)

    db.settings.update_one(
        {"key": "payment_methods_initialized"},
        {"$set": {"key": "payment_methods_initialized", "initialized_at": utcnow()}},
        upsert=True,
    )


def _payment_method_configured(method):
    provider = str(method.get("provider") or method.get("code") or "").lower()
    if provider == "paymob":
        return _paymob_configured()
    return bool(method.get("configured", False))


def _serialize_payment_method(method):
    return {
        "id": str(method["_id"]),
        "code": method.get("code", ""),
        "name": method.get("name", ""),
        "provider": method.get("provider", method.get("code", "")),
        "description": method.get("description", ""),
        "active": method.get("active", True),
        "sort_order": int(method.get("sort_order", 0) or 0),
        "configured": _payment_method_configured(method),
    }


def _paymob_amount_cents(plan):
    amount = Decimal(str(plan.get("price", 0)))
    source_currency = str(plan.get("currency", "USD")).upper()
    target_currency = settings.PAYMOB_CURRENCY

    if source_currency == target_currency:
        target_amount = amount
    elif source_currency == "USD" and target_currency == "EGP":
        target_amount = amount * settings.EGP_PER_USD
    else:
        raise ValueError(
            f"Paymob checkout cannot convert {source_currency} to {target_currency}. "
            "Configure the plan currency to match PAYMOB_CURRENCY."
        )

    cents = int((target_amount * Decimal("100")).quantize(Decimal("1")))
    if cents <= 0:
        raise ValueError("Payment amount must be greater than zero.")
    return cents, target_currency, float(target_amount.quantize(Decimal("0.01")))


def _paymob_bool(value):
    return "true" if bool(value) else "false"


def _verify_paymob_transaction_hmac(obj, received_hmac):
    try:
        order = obj.get("order") or {}
        source = obj.get("source_data") or {}
        fields = [
            obj["amount_cents"],
            obj["created_at"],
            obj["currency"],
            obj["error_occured"],
            obj["has_parent_transaction"],
            obj["id"],
            obj["integration_id"],
            obj["is_3d_secure"],
            obj["is_auth"],
            obj["is_capture"],
            obj["is_refunded"],
            obj["is_standalone_payment"],
            obj["is_voided"],
            order["id"],
            obj["owner"],
            obj["pending"],
            source.get("pan", ""),
            source.get("sub_type", ""),
            source.get("type", ""),
            obj["success"],
        ]
    except (KeyError, TypeError):
        return False

    concat = "".join(
        _paymob_bool(value) if isinstance(value, bool) else str(value)
        for value in fields
    )
    computed = hmac.new(
        settings.PAYMOB_HMAC_SECRET.encode(),
        concat.encode(),
        hashlib.sha512,
    ).hexdigest()
    return hmac.compare_digest(computed, str(received_hmac or ""))


def _serialize_payment(payment):
    return {
        "id": str(payment["_id"]),
        "gateway": payment.get("gateway", ""),
        "amount": float(payment.get("amount", 0)),
        "currency": payment.get("currency", "USD"),
        "status": payment.get("status", "pending"),
        "provider_transaction_id": str(payment.get("provider_transaction_id") or ""),
        "created_at": serialize_datetime(payment.get("created_at")),
        "updated_at": serialize_datetime(payment.get("updated_at")),
    }


@api_view(["GET"])
def payments(request):
    db = get_db()
    owner = owner_oid(request)
    user_doc = db.users.find_one({"_id": owner})

    if not user_doc:
        return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)

    plans = []
    for plan in db.subscription_plans.find({"active": {"$ne": False}}).sort("created_at", ASCENDING):
        plans.append({
            "id": str(plan["_id"]),
            "name": plan.get("name", "Revnivo"),
            "price": float(plan.get("price", 0)),
            "currency": plan.get("currency", "USD"),
            "trial_days": plan.get("trial_days", 0),
        })

    if not plans:
        fallback = db.settings.find_one({"key": "subscription_plan"}) or {"price": 3.0}
        plans.append({
            "id": "default",
            "name": "Revnivo",
            "price": float(fallback.get("price", 3.0)),
            "currency": "USD",
            "trial_days": 30,
        })

    _ensure_default_payment_methods(db)
    gateways = []
    for method in db.payment_methods.find({"active": {"$ne": False}}).sort(
        [("sort_order", ASCENDING), ("created_at", ASCENDING)]
    ):
        item = _serialize_payment_method(method)
        gateways.append({
            "id": item["code"],
            "record_id": item["id"],
            "code": item["code"],
            "name": item["name"],
            "provider": item["provider"],
            "description": item["description"],
            "configured": item["configured"],
        })

    payment_rows = [
        _serialize_payment(payment)
        for payment in db.payment_transactions.find({"owner_id": owner})
        .sort("created_at", DESCENDING)
        .limit(50)
    ]

    return Response({
        "subscription": {
            "status": user_doc.get("subscription_status", "trial"),
            "payment_method": user_doc.get("payment_method"),
            "trial_ends_at": serialize_datetime(user_doc.get("trial_ends_at")),
        },
        "plans": plans,
        "gateways": gateways,
        "payments": payment_rows,
    })


@api_view(["POST"])
def paymob_checkout(request):
    if not _paymob_configured():
        return Response(
            {"detail": "Paymob is not configured yet. Add the Paymob keys to backend/.env and restart Django."},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    db = get_db()
    owner = owner_oid(request)
    user_doc = db.users.find_one({"_id": owner})
    if not user_doc:
        return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)

    phone = str(request.data.get("phone", "")).strip()
    if not re.fullmatch(r"\+?[0-9]{8,15}", phone):
        return Response(
            {"detail": "Enter a valid phone number using 8 to 15 digits."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    plan_id = str(request.data.get("plan_id", "")).strip()
    if plan_id and plan_id != "default":
        plan_oid = oid(plan_id)
        plan = db.subscription_plans.find_one({"_id": plan_oid, "active": {"$ne": False}}) if plan_oid else None
    else:
        plan = None

    if not plan:
        fallback = db.settings.find_one({"key": "subscription_plan"}) or {"price": 3.0}
        plan = {
            "_id": None,
            "name": "Revnivo",
            "price": float(fallback.get("price", 3.0)),
            "currency": "USD",
            "trial_days": 30,
        }

    try:
        amount_cents, paymob_currency, paymob_amount = _paymob_amount_cents(plan)
        integration_id = int(settings.PAYMOB_INTEGRATION_ID_CARD)
    except (TypeError, ValueError) as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    name_parts = (user_doc.get("name") or "Revnivo User").strip().split()
    first_name = name_parts[0] if name_parts else "Revnivo"
    last_name = " ".join(name_parts[1:]) or "User"
    reference = f"revnivo-{owner}-{secrets.token_hex(6)}"
    now = utcnow()

    payment_doc = {
        "owner_id": owner,
        "plan_id": plan.get("_id"),
        "plan_name": plan.get("name", "Revnivo"),
        "gateway": "paymob",
        "amount": paymob_amount,
        "currency": paymob_currency,
        "original_amount": float(plan.get("price", 0)),
        "original_currency": str(plan.get("currency", "USD")).upper(),
        "status": "creating",
        "special_reference": reference,
        "created_at": now,
        "updated_at": now,
    }
    payment_result = db.payment_transactions.insert_one(payment_doc)

    payload = {
        "amount": amount_cents,
        "currency": paymob_currency,
        "payment_methods": [integration_id],
        "items": [{
            "name": plan.get("name", "Revnivo Subscription")[:120],
            "amount": amount_cents,
            "description": "Revnivo subscription",
            "quantity": 1,
        }],
        "billing_data": {
            "first_name": first_name,
            "last_name": last_name,
            "email": user_doc.get("email", ""),
            "phone_number": phone,
            "apartment": "NA",
            "floor": "NA",
            "street": "NA",
            "building": "NA",
            "shipping_method": "NA",
            "postal_code": "NA",
            "city": "NA",
            "state": "NA",
            "country": "EGY",
        },
        "customer": {
            "first_name": first_name,
            "last_name": last_name,
            "email": user_doc.get("email", ""),
        },
        "special_reference": reference,
        "expiration": 3600,
    }

    if settings.PAYMOB_WEBHOOK_URL:
        payload["notification_url"] = settings.PAYMOB_WEBHOOK_URL
    if settings.PAYMOB_REDIRECT_URL:
        payload["redirection_url"] = settings.PAYMOB_REDIRECT_URL

    try:
        response = http_requests.post(
            f"{settings.PAYMOB_BASE_URL}/v1/intention/",
            headers={
                "Authorization": f"Token {settings.PAYMOB_SECRET_KEY}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=25,
        )
        response.raise_for_status()
        intention = response.json()
    except http_requests.RequestException as exc:
        detail = "Paymob could not create the checkout session."
        if getattr(exc, "response", None) is not None:
            try:
                paymob_error = exc.response.json()
                detail = paymob_error.get("detail") or paymob_error.get("message") or detail
            except Exception:
                pass
        db.payment_transactions.update_one(
            {"_id": payment_result.inserted_id},
            {"$set": {"status": "failed", "failure_reason": detail, "updated_at": utcnow()}},
        )
        return Response({"detail": detail}, status=status.HTTP_502_BAD_GATEWAY)

    client_secret = intention.get("client_secret")
    paymob_order_id = intention.get("intention_order_id")
    intention_id = intention.get("id")

    if not client_secret:
        db.payment_transactions.update_one(
            {"_id": payment_result.inserted_id},
            {"$set": {"status": "failed", "failure_reason": "Missing client secret.", "updated_at": utcnow()}},
        )
        return Response(
            {"detail": "Paymob returned an incomplete checkout response."},
            status=status.HTTP_502_BAD_GATEWAY,
        )

    checkout_url = (
        f"{settings.PAYMOB_BASE_URL}/unifiedcheckout/?"
        + urlencode({
            "publicKey": settings.PAYMOB_PUBLIC_KEY,
            "clientSecret": client_secret,
        })
    )

    db.payment_transactions.update_one(
        {"_id": payment_result.inserted_id},
        {"$set": {
            "status": "pending",
            "paymob_intention_id": intention_id,
            "paymob_order_id": paymob_order_id,
            "checkout_url": checkout_url,
            "updated_at": utcnow(),
        }},
    )

    return Response({
        "payment_id": str(payment_result.inserted_id),
        "checkout_url": checkout_url,
    }, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([AllowAny])
@authentication_classes([])
@parser_classes([JSONParser])
def paymob_webhook(request):
    if not settings.PAYMOB_HMAC_SECRET:
        return Response(
            {"detail": "Paymob HMAC secret is not configured."},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    body = request.data or {}
    if body.get("type") != "TRANSACTION":
        return Response({"received": True})

    obj = body.get("obj") or {}
    received_hmac = request.query_params.get("hmac", "")

    if not _verify_paymob_transaction_hmac(obj, received_hmac):
        return Response({"detail": "Invalid Paymob HMAC."}, status=status.HTTP_401_UNAUTHORIZED)

    order = obj.get("order") or {}
    paymob_order_id = order.get("id")
    db = get_db()

    payment = db.payment_transactions.find_one({"paymob_order_id": paymob_order_id})
    if not payment:
        merchant_reference = str(order.get("merchant_order_id") or "")
        if merchant_reference:
            payment = db.payment_transactions.find_one({"special_reference": merchant_reference})

    if not payment:
        return Response({"received": True})

    expected_amount_cents = int(
        (Decimal(str(payment.get("amount", 0))) * Decimal("100")).quantize(Decimal("1"))
    )
    received_amount_cents = int(obj.get("amount_cents") or 0)
    received_currency = str(obj.get("currency") or "").upper()
    expected_currency = str(payment.get("currency") or "").upper()
    received_integration = str(obj.get("integration_id") or "")
    expected_integration = str(settings.PAYMOB_INTEGRATION_ID_CARD)

    payment_matches = (
        received_amount_cents == expected_amount_cents
        and received_currency == expected_currency
        and received_integration == expected_integration
    )

    success = (
        payment_matches
        and bool(obj.get("success"))
        and not bool(obj.get("pending"))
    )
    failed = not bool(obj.get("pending")) and not success
    payment_status = "paid" if success else "failed" if failed else "pending"

    update = {
        "status": payment_status,
        "provider_transaction_id": str(obj.get("id") or ""),
        "provider_response": str((obj.get("data") or {}).get("message") or "")[:500],
        "provider_amount_cents": received_amount_cents,
        "provider_currency": received_currency,
        "updated_at": utcnow(),
    }

    if not payment_matches:
        update["failure_reason"] = "Payment verification mismatch."

    db.payment_transactions.update_one({"_id": payment["_id"]}, {"$set": update})

    if success:
        db.users.update_one(
            {"_id": payment["owner_id"]},
            {"$set": {
                "subscription_status": "active",
                "payment_method": "Paymob",
                "subscription_activated_at": utcnow(),
                "updated_at": utcnow(),
            }},
        )

    return Response({"received": True})


@api_view(["GET", "PATCH"])
def subscriptions(request):
    if not require_admin(request):
        return Response({"detail": "Admin access required."}, status=status.HTTP_403_FORBIDDEN)
    db = get_db()
    if request.method == "PATCH" and request.data.get("plan_price") is not None:
        try:
            plan_price = round(float(request.data["plan_price"]), 2)
            if plan_price <= 0:
                raise ValueError
        except (TypeError, ValueError):
            return Response({"detail": "Plan price must be a positive number."}, status=status.HTTP_400_BAD_REQUEST)
        db.settings.update_one({"key": "subscription_plan"}, {"$set": {"key": "subscription_plan", "price": plan_price, "updated_at": utcnow()}}, upsert=True)
    elif request.method == "PATCH":
        user_id = oid(request.data.get("user_id"))
        if not user_id:
            return Response({"detail": "Invalid user id."}, status=status.HTTP_400_BAD_REQUEST)
        updates = {key: request.data[key] for key in ("subscription_status", "payment_method") if key in request.data}
        db.users.update_one({"_id": user_id}, {"$set": updates})
    docs = (doc for doc in db.users.find({}).sort("created_at", DESCENDING) if not is_admin_doc(doc))
    now = utcnow()
    result = []
    for doc in docs:
        trial_ends = doc.get("trial_ends_at")
        result.append({**serialize_user(doc, request), "trial_active": is_active_trial(trial_ends), "payment_method": doc.get("payment_method"), "created_at": serialize_datetime(doc.get("created_at"))})
    plan = db.settings.find_one({"key": "subscription_plan"}) or {"price": 3.0}
    return Response({"plan": {"price": float(plan.get("price", 3.0)), "currency": "USD", "trial_days": 30}, "users": result})


@api_view(["GET", "POST", "PATCH", "DELETE"])
def admin_plans(request):
    if not require_admin(request):
        return Response({"detail": "Admin access required."}, status=status.HTTP_403_FORBIDDEN)

    db = get_db()

    if request.method == "POST":
        name = str(request.data.get("name", "")).strip()
        currency = str(request.data.get("currency", "USD")).strip().upper()[:3]
        try:
            price = round(float(request.data.get("price", 0)), 2)
            trial_days = max(int(request.data.get("trial_days", 0)), 0)
        except (TypeError, ValueError):
            return Response({"detail": "Invalid plan values."}, status=status.HTTP_400_BAD_REQUEST)

        if not name or price <= 0 or len(currency) != 3:
            return Response(
                {"detail": "Plan name, positive price, and 3-letter currency are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        now = utcnow()
        result = db.subscription_plans.insert_one({
            "name": name[:100],
            "price": price,
            "currency": currency,
            "trial_days": trial_days,
            "active": bool(request.data.get("active", True)),
            "created_at": now,
            "updated_at": now,
        })
        plan = db.subscription_plans.find_one({"_id": result.inserted_id})
        return Response({
            "id": str(plan["_id"]),
            "name": plan["name"],
            "price": float(plan["price"]),
            "currency": plan.get("currency", "USD"),
            "trial_days": plan.get("trial_days", 0),
            "active": plan.get("active", True),
        }, status=status.HTTP_201_CREATED)

    if request.method in ("PATCH", "DELETE"):
        plan_id = oid(request.data.get("id"))
        if not plan_id:
            return Response({"detail": "Invalid plan id."}, status=status.HTTP_400_BAD_REQUEST)

        if request.method == "DELETE":
            result = db.subscription_plans.delete_one({"_id": plan_id})
            if not result.deleted_count:
                return Response({"detail": "Plan not found."}, status=status.HTTP_404_NOT_FOUND)
            return Response(status=status.HTTP_204_NO_CONTENT)

        updates = {}
        if "name" in request.data:
            name = str(request.data.get("name", "")).strip()
            if not name:
                return Response({"detail": "Plan name is required."}, status=status.HTTP_400_BAD_REQUEST)
            updates["name"] = name[:100]
        if "price" in request.data:
            try:
                price = round(float(request.data.get("price")), 2)
            except (TypeError, ValueError):
                price = 0
            if price <= 0:
                return Response({"detail": "Plan price must be positive."}, status=status.HTTP_400_BAD_REQUEST)
            updates["price"] = price
        if "currency" in request.data:
            currency = str(request.data.get("currency", "")).strip().upper()
            if len(currency) != 3:
                return Response({"detail": "Currency must be a 3-letter code."}, status=status.HTTP_400_BAD_REQUEST)
            updates["currency"] = currency
        if "trial_days" in request.data:
            try:
                updates["trial_days"] = max(int(request.data.get("trial_days", 0)), 0)
            except (TypeError, ValueError):
                return Response({"detail": "Trial days must be a number."}, status=status.HTTP_400_BAD_REQUEST)
        if "active" in request.data:
            updates["active"] = bool(request.data.get("active"))

        updates["updated_at"] = utcnow()
        db.subscription_plans.update_one({"_id": plan_id}, {"$set": updates})

    plans = []
    for plan in db.subscription_plans.find({}).sort("created_at", DESCENDING):
        plans.append({
            "id": str(plan["_id"]),
            "name": plan.get("name", ""),
            "price": float(plan.get("price", 0)),
            "currency": plan.get("currency", "USD"),
            "trial_days": plan.get("trial_days", 0),
            "active": plan.get("active", True),
        })

    coupons = []
    for coupon in db.subscription_coupons.find({}).sort("created_at", DESCENDING):
        coupons.append({
            "id": str(coupon["_id"]),
            "code": coupon.get("code", ""),
            "discount_type": coupon.get("discount_type", "percent"),
            "discount_value": coupon.get("discount_value", 0),
            "active": coupon.get("active", True),
        })

    return Response({"plans": plans, "coupons": coupons})


@api_view(["GET", "POST", "PATCH", "DELETE"])
def admin_payment_methods(request):
    if not require_admin(request):
        return Response({"detail": "Admin access required."}, status=status.HTTP_403_FORBIDDEN)

    db = get_db()
    _ensure_default_payment_methods(db)

    if request.method == "POST":
        name = str(request.data.get("name", "")).strip()
        provider = _payment_method_code(request.data.get("provider") or name)
        code = _payment_method_code(request.data.get("code") or name)
        description = str(request.data.get("description", "")).strip()

        if not name or not code:
            return Response(
                {"detail": "Payment method name is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if db.payment_methods.find_one({"code": code}):
            return Response(
                {"detail": "A payment method with this code already exists."},
                status=status.HTTP_409_CONFLICT,
            )

        try:
            sort_order = int(request.data.get("sort_order", 100))
        except (TypeError, ValueError):
            sort_order = 100

        now = utcnow()
        result = db.payment_methods.insert_one({
            "code": code,
            "name": name[:100],
            "provider": provider or code,
            "description": description[:300],
            "active": bool(request.data.get("active", True)),
            "sort_order": sort_order,
            "created_at": now,
            "updated_at": now,
        })
        method = db.payment_methods.find_one({"_id": result.inserted_id})
        return Response(_serialize_payment_method(method), status=status.HTTP_201_CREATED)

    if request.method in ("PATCH", "DELETE"):
        method_id = oid(request.data.get("id"))
        if not method_id:
            return Response({"detail": "Invalid payment method id."}, status=status.HTTP_400_BAD_REQUEST)

        method = db.payment_methods.find_one({"_id": method_id})
        if not method:
            return Response({"detail": "Payment method not found."}, status=status.HTTP_404_NOT_FOUND)

        if request.method == "DELETE":
            db.payment_methods.delete_one({"_id": method_id})
            return Response(status=status.HTTP_204_NO_CONTENT)

        updates = {}
        if "name" in request.data:
            name = str(request.data.get("name", "")).strip()
            if not name:
                return Response({"detail": "Payment method name is required."}, status=status.HTTP_400_BAD_REQUEST)
            updates["name"] = name[:100]
        if "code" in request.data:
            code = _payment_method_code(request.data.get("code"))
            if not code:
                return Response({"detail": "Payment method code is required."}, status=status.HTTP_400_BAD_REQUEST)
            existing = db.payment_methods.find_one({"code": code, "_id": {"$ne": method_id}})
            if existing:
                return Response({"detail": "Another payment method already uses this code."}, status=status.HTTP_409_CONFLICT)
            updates["code"] = code
        if "provider" in request.data:
            updates["provider"] = _payment_method_code(request.data.get("provider")) or method.get("provider", method.get("code", ""))
        if "description" in request.data:
            updates["description"] = str(request.data.get("description", "")).strip()[:300]
        if "active" in request.data:
            updates["active"] = bool(request.data.get("active"))
        if "sort_order" in request.data:
            try:
                updates["sort_order"] = int(request.data.get("sort_order", 100))
            except (TypeError, ValueError):
                return Response({"detail": "Sort order must be a number."}, status=status.HTTP_400_BAD_REQUEST)

        updates["updated_at"] = utcnow()
        db.payment_methods.update_one({"_id": method_id}, {"$set": updates})

    methods = [
        _serialize_payment_method(method)
        for method in db.payment_methods.find({}).sort(
            [("sort_order", ASCENDING), ("created_at", ASCENDING)]
        )
    ]
    return Response({"payment_methods": methods})


@api_view(["POST", "PATCH", "DELETE"])
def admin_coupons(request):
    if not require_admin(request):
        return Response({"detail": "Admin access required."}, status=status.HTTP_403_FORBIDDEN)
    db = get_db()
    if request.method == "POST":
        code = str(request.data.get("code", "")).strip().upper()
        discount_type = request.data.get("discount_type", "percent")
        try:
            discount_value = float(request.data.get("discount_value", 0))
        except (TypeError, ValueError):
            discount_value = 0
        if not code or discount_type not in ("percent", "fixed") or discount_value <= 0:
            return Response({"detail": "Valid coupon code and discount are required."}, status=status.HTTP_400_BAD_REQUEST)
        now = utcnow()
        result = db.subscription_coupons.insert_one({"code": code, "discount_type": discount_type, "discount_value": discount_value, "active": True, "created_at": now, "updated_at": now})
        return Response({"id": str(result.inserted_id), "code": code, "discount_type": discount_type, "discount_value": discount_value, "active": True}, status=status.HTTP_201_CREATED)
    coupon_id = oid(request.data.get("id"))
    if not coupon_id:
        return Response({"detail": "Invalid coupon id."}, status=status.HTTP_400_BAD_REQUEST)
    if request.method == "DELETE":
        db.subscription_coupons.delete_one({"_id": coupon_id})
        return Response(status=status.HTTP_204_NO_CONTENT)
    updates = {key: request.data[key] for key in ("code", "discount_type", "discount_value", "active") if key in request.data}
    if "code" in updates: updates["code"] = str(updates["code"]).strip().upper()
    updates["updated_at"] = utcnow()
    db.subscription_coupons.update_one({"_id": coupon_id}, {"$set": updates})
    return Response({"status": "updated"})


@api_view(["GET", "PATCH", "DELETE"])
def notifications(request):
    db = get_db()
    owner = owner_oid(request)
    viewer = db.users.find_one({"_id": owner})
    query = {"$or": [{"owner_id": None}, {"owner_id": owner}]}
    if is_admin_doc(viewer):
        query["kind"] = {"$in": ["user", "chat", "subscription"]}
    else:
        query["kind"] = "chat"
    if request.method == "DELETE":
        db.notifications.delete_many(query)
        return Response(status=status.HTTP_204_NO_CONTENT)
    if request.method == "PATCH":
        if request.data.get("all"):
            db.notifications.update_many(query, {"$set": {"read": True}})
        else:
            notification_id = oid(request.data.get("id"))
            if notification_id:
                db.notifications.update_one({"_id": notification_id, **query}, {"$set": {"read": True}})
    docs = db.notifications.find(query).sort("created_at", DESCENDING).limit(50)
    return Response([{**{key: doc.get(key) for key in ("kind", "title", "message", "read", "chat_user_id")}, "id": str(doc["_id"]), "created_at": serialize_datetime(doc.get("created_at"))} for doc in docs])


def chat_message_preview(message, viewer_id):
    if not message:
        return ""

    if message.get("deleted"):
        deleted_by = message.get("deleted_by")
        if deleted_by and str(deleted_by) == str(viewer_id):
            return "You deleted this message"
        return "This message was deleted"

    content = str(message.get("content") or "").strip()
    message_type = str(message.get("message_type") or "text").lower()

    if message_type == "image":
        return "Photo"
    if message_type == "audio":
        return "Voice message"
    if message_type == "video":
        return "Video"
    if message_type == "file":
        return "Document"

    return content


@api_view(["GET", "POST", "PATCH", "DELETE"])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def support_chat(request):
    db = get_db()
    owner = owner_oid(request)
    user_doc = db.users.find_one({"_id": owner})
    db.users.update_one({"_id": owner}, {"$set": {"last_seen": utcnow()}})
    if request.method == "PATCH":
        chat_user_id = oid(request.data.get("user_id")) if is_admin_doc(user_doc) else owner
        if chat_user_id:
            db.notifications.update_many({"kind": "chat", "chat_user_id": str(chat_user_id), "read": False, "$or": [{"owner_id": None}, {"owner_id": owner}]}, {"$set": {"read": True}})
        return Response({"status": "read"})
    if request.method == "DELETE":
        if request.data.get("mode") == "chat":
            if not is_admin_doc(user_doc):
                return Response({"detail": "Admin access required."}, status=status.HTTP_403_FORBIDDEN)
            chat_user_id = oid(request.data.get("user_id"))
            if not chat_user_id:
                return Response({"detail": "Invalid user id."}, status=status.HTTP_400_BAD_REQUEST)
            for chat_message in db.chat_messages.find(
                {"user_id": chat_user_id},
                {"attachment": 1},
            ):
                if chat_message.get("attachment"):
                    delete_logo(chat_message["attachment"])

            result = db.chat_messages.delete_many({"user_id": chat_user_id})
            db.notifications.delete_many({"kind": "chat", "chat_user_id": str(chat_user_id)})
            return Response({"status": "cleared", "deleted_messages": result.deleted_count})

        message_id = oid(request.data.get("id"))
        if not message_id:
            return Response({"detail": "Invalid message id."}, status=status.HTTP_400_BAD_REQUEST)
        message = db.chat_messages.find_one({"_id": message_id})
        if not message:
            return Response({"detail": "Message not found."}, status=status.HTTP_404_NOT_FOUND)

        if not is_admin_doc(user_doc) and message.get("user_id") != owner:
            return Response({"detail": "Message not found."}, status=status.HTTP_404_NOT_FOUND)

        if request.data.get("mode") == "everyone":
            allowed = is_admin_doc(user_doc) or (
                message.get("user_id") == owner
                and message.get("sender") == "user"
            )
            if not allowed:
                return Response(
                    {"detail": "You can only delete your own messages for everyone."},
                    status=status.HTTP_403_FORBIDDEN,
                )
            if message.get("attachment"):
                delete_logo(message["attachment"])
            db.chat_messages.update_one(
                {"_id": message_id},
                {
                    "$set": {
                        "deleted": True,
                        "deleted_by": owner,
                        "content": "",
                        "attachment": "",
                    }
                },
            )
        else:
            db.chat_messages.update_one(
                {"_id": message_id},
                {"$addToSet": {"deleted_for": owner}},
            )
        return Response({"status": "deleted"})
    if request.method == "GET" and is_admin_doc(user_doc) and request.query_params.get("summary"):
        users = [doc for doc in db.users.find({"role": {"$ne": "admin"}}).sort("created_at", DESCENDING)]
        summaries = []
        for contact in users:
            contact_id = contact["_id"]
            latest = db.chat_messages.find_one(
                {
                    "user_id": contact_id,
                    "deleted_for": {"$ne": owner},
                },
                sort=[("created_at", DESCENDING)],
            )
            unread_count = db.notifications.count_documents({"kind": "chat", "chat_user_id": str(contact_id), "$or": [{"owner_id": None}, {"owner_id": owner}], "read": False})
            last_seen = contact.get("last_seen")
            typing_until = contact.get("typing_until")
            recording_until = contact.get("recording_until")
            if last_seen and last_seen.tzinfo is None:
                last_seen = last_seen.replace(tzinfo=timezone.utc)
            if typing_until and typing_until.tzinfo is None:
                typing_until = typing_until.replace(tzinfo=timezone.utc)
            if recording_until and recording_until.tzinfo is None:
                recording_until = recording_until.replace(tzinfo=timezone.utc)
            latest_message = chat_message_preview(latest, owner)
            summaries.append({
                **serialize_user(contact, request),
                "online": bool(last_seen and utcnow() - last_seen <= timedelta(minutes=2)),
                "typing": bool(typing_until and utcnow() < typing_until),
                "recording": bool(recording_until and utcnow() < recording_until),
                "unread_count": unread_count,
                "last_message": latest_message,
                "last_message_at": serialize_datetime(latest.get("created_at")) if latest else None,
            })
        return Response(summaries)
    if request.method == "POST":
        content = str(request.data.get("content", "")).strip()
        attachment = request.FILES.get("attachment")
        if not content and not attachment:
            return Response({"detail": "Message is required."}, status=status.HTTP_400_BAD_REQUEST)
        target_user = oid(request.data.get("user_id")) if is_admin_doc(user_doc) else owner
        if not target_user:
            return Response({"detail": "Select a user before replying."}, status=status.HTTP_400_BAD_REQUEST)

        if is_admin_doc(user_doc):
            target_doc = db.users.find_one({"_id": target_user, "role": {"$ne": "admin"}}, {"_id": 1})
            if not target_doc:
                return Response({"detail": "Chat user not found."}, status=status.HTTP_404_NOT_FOUND)

        requested_type = str(request.data.get("message_type", "text")).lower()
        message_type = requested_type if requested_type in {"text", "image", "audio", "video", "file"} else "file"

        if attachment:
            mime_type = str(getattr(attachment, "content_type", "") or "").lower()
            if mime_type.startswith("image/"):
                message_type = "image"
            elif mime_type.startswith("audio/"):
                message_type = "audio"
            elif mime_type.startswith("video/"):
                message_type = "video"
            elif message_type == "text":
                message_type = "file"

        message = {
            "user_id": target_user,
            "content": content[:2000],
            "message_type": message_type,
            "sender": "admin" if is_admin_doc(user_doc) else "user",
            "created_at": utcnow(),
        }
        if attachment:
            message["attachment"] = save_upload(attachment, "chat")
        db.chat_messages.insert_one(message)
        if message["sender"] == "user":
            admin_ids = [admin["_id"] for admin in db.users.find({"role": "admin"}, {"_id": 1})]
            for admin_id in admin_ids:
                create_notification("chat", "New support message", f"{user_doc.get('name', user_doc.get('email'))} sent a support message.", admin_id, target_user)
        else:
            create_notification("chat", "New support reply", "The Revnivo admin replied to your support message.", target_user, target_user)
    selected_user = oid(request.query_params.get("user_id")) if is_admin_doc(user_doc) else owner
    query = {"user_id": selected_user} if selected_user else {"user_id": owner}
    docs = db.chat_messages.find(query).sort("created_at", ASCENDING)
    result = []
    for doc in docs:
        if owner in doc.get("deleted_for", []):
            continue
        attachment = doc.get("attachment", "")
        result.append({
            **{key: doc.get(key) for key in ("content", "sender", "message_type")},
            "deleted": bool(doc.get("deleted")),
            "deleted_by_me": bool(
                doc.get("deleted_by")
                and str(doc.get("deleted_by")) == str(owner)
            ),
            "preview_text": chat_message_preview(doc, owner),
            "id": str(doc["_id"]),
            "user_id": str(doc["user_id"]),
            "created_at": serialize_datetime(doc.get("created_at")),
            "attachment_url": f"/api/support-chat/{doc['_id']}/attachment/" if attachment else "",
        })
    return Response(result)


@api_view(["GET"])
def support_chat_attachment(request, message_id):
    message_oid = oid(message_id)
    if not message_oid:
        return Response({"detail": "Attachment not found."}, status=status.HTTP_404_NOT_FOUND)

    db = get_db()
    owner = owner_oid(request)
    viewer = db.users.find_one({"_id": owner})
    message = db.chat_messages.find_one({"_id": message_oid})

    if not message or not message.get("attachment") or message.get("deleted"):
        return Response({"detail": "Attachment not found."}, status=status.HTTP_404_NOT_FOUND)

    if not is_admin_doc(viewer) and message.get("user_id") != owner:
        return Response({"detail": "Attachment not found."}, status=status.HTTP_404_NOT_FOUND)

    if owner in message.get("deleted_for", []):
        return Response({"detail": "Attachment not found."}, status=status.HTTP_404_NOT_FOUND)

    target = resolve_upload_path(message["attachment"])
    if not target:
        return Response({"detail": "Attachment not found."}, status=status.HTTP_404_NOT_FOUND)

    content_type = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
    inline = (
        content_type.startswith("image/")
        or content_type.startswith("audio/")
    )

    response = FileResponse(
        target.open("rb"),
        content_type=content_type,
        as_attachment=not inline,
        filename=target.name,
    )
    response["Cache-Control"] = "private, no-store"
    response["X-Content-Type-Options"] = "nosniff"
    return response


@api_view(["GET", "POST"])
@parser_classes([JSONParser])
def chat_presence(request):
    db = get_db()
    owner = owner_oid(request)

    if request.method == "POST":
        if request.data.get("offline"):
            db.users.update_one(
                {"_id": owner},
                {"$set": {
                    "last_seen": None,
                    "typing_until": None,
                    "typing_for": None,
                    "recording_until": None,
                    "recording_for": None,
                }},
            )
            return Response({"status": "offline"})

        activity_for = request.data.get("user_id") if request.data.get("user_id") else "admin"

        if "recording" in request.data:
            is_recording = bool(request.data.get("recording"))
            updates = {
                "recording_until": utcnow() + timedelta(seconds=5) if is_recording else None,
                "recording_for": str(activity_for) if is_recording else None,
            }
            if is_recording:
                updates.update({"typing_until": None, "typing_for": None})
            db.users.update_one({"_id": owner}, {"$set": updates})
            return Response({"status": "recording" if is_recording else "idle"})

        is_typing = bool(request.data.get("typing"))
        updates = {
            "typing_until": utcnow() + timedelta(seconds=4) if is_typing else None,
            "typing_for": str(activity_for) if is_typing else None,
        }
        if is_typing:
            updates.update({"recording_until": None, "recording_for": None})
        db.users.update_one({"_id": owner}, {"$set": updates})
        return Response({"status": "typing" if is_typing else "idle"})

    db.users.update_one({"_id": owner}, {"$set": {"last_seen": utcnow()}})
    viewer = db.users.find_one({"_id": owner})
    query = {"role": "admin"} if not is_admin_doc(viewer) else {"role": {"$ne": "admin"}}
    people = []

    for person in db.users.find(query).sort("created_at", DESCENDING):
        last_seen = person.get("last_seen")
        typing_until = person.get("typing_until")
        recording_until = person.get("recording_until")

        if last_seen and last_seen.tzinfo is None:
            last_seen = last_seen.replace(tzinfo=timezone.utc)
        if typing_until and typing_until.tzinfo is None:
            typing_until = typing_until.replace(tzinfo=timezone.utc)
        if recording_until and recording_until.tzinfo is None:
            recording_until = recording_until.replace(tzinfo=timezone.utc)

        typing_for = str(person.get("typing_for") or "")
        recording_for = str(person.get("recording_for") or "")
        viewer_target = ("admin", str(owner))

        is_typing = bool(
            typing_until
            and utcnow() < typing_until
            and (is_admin_doc(viewer) or typing_for in viewer_target)
        )
        is_recording = bool(
            recording_until
            and utcnow() < recording_until
            and (is_admin_doc(viewer) or recording_for in viewer_target)
        )

        people.append({
            "id": str(person["_id"]),
            "name": person.get("name") or person.get("email", ""),
            "online": bool(last_seen and utcnow() - last_seen <= timedelta(minutes=2)),
            "typing": is_typing and not is_recording,
            "recording": is_recording,
        })

    return Response(people)

@api_view(["GET", "POST"])
@parser_classes([JSONParser])
def notes(request):
    db = get_db()
    owner = owner_oid(request)
    if request.method == "GET":
        page = max(int(request.query_params.get("page", 1)), 1)
        page_size = 8
        query = {"owner_id": owner}
        search = request.query_params.get("search", "").strip()[:100]
        if search:
            safe_search = re.escape(search)
            query["$or"] = [
                {"title": {"$regex": safe_search, "$options": "i"}},
                {"content": {"$regex": safe_search, "$options": "i"}},
            ]
        total = db.notes.count_documents(query)
        docs = db.notes.find(query).sort("updated_at", DESCENDING).skip((page - 1) * page_size).limit(page_size)
        return Response({
            "results": [serialize_note(doc) for doc in docs],
            "pagination": {"page": page, "page_size": page_size, "total": total, "pages": max((total + page_size - 1) // page_size, 1)},
        })

    title = str(request.data.get("title", "")).strip()
    content = str(request.data.get("content", "")).strip()
    if not content:
        return Response({"detail": "Note content is required."}, status=status.HTTP_400_BAD_REQUEST)
    now = utcnow()
    result = db.notes.insert_one({"owner_id": owner, "title": title[:160], "content": content[:5000], "created_at": now, "updated_at": now})
    return Response(serialize_note({"_id": result.inserted_id, "title": title[:160], "content": content[:5000], "created_at": now, "updated_at": now}), status=status.HTTP_201_CREATED)


@api_view(["PATCH", "DELETE"])
@parser_classes([JSONParser])
def note_detail(request, note_id):
    note_oid = oid(note_id)
    if not note_oid:
        return Response({"detail": "Invalid note id."}, status=status.HTTP_400_BAD_REQUEST)
    db = get_db()
    if request.method == "PATCH":
        updates = {key: str(request.data[key]).strip() for key in ("title", "content") if key in request.data}
        if not updates.get("content"):
            return Response({"detail": "Note content is required."}, status=status.HTTP_400_BAD_REQUEST)
        updates["updated_at"] = utcnow()
        db.notes.update_one({"_id": note_oid, "owner_id": owner_oid(request)}, {"$set": updates})
        doc = db.notes.find_one({"_id": note_oid, "owner_id": owner_oid(request)})
        return Response(serialize_note(doc))
    result = db.notes.delete_one({"_id": note_oid, "owner_id": owner_oid(request)})
    if not result.deleted_count:
        return Response({"detail": "Note not found."}, status=status.HTTP_404_NOT_FOUND)
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["GET", "POST"])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def platforms(request):
    db = get_db()
    owner = owner_oid(request)
    if request.method == "GET":
        docs = db.platforms.find({"owner_id": owner, "is_archived": {"$ne": True}}).sort([("display_order", ASCENDING), ("created_at", DESCENDING)])
        return Response([serialize_platform(d, request) for d in docs])

    serializer = PlatformSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data
    logo_path = save_logo(data["logo"]) if data.get("logo") else ""
    doc = {
        "owner_id": owner,
        "name": data["name"].strip(),
        "website": data.get("website", "").strip(),
        "default_currency": data.get("default_currency", "USD").upper(),
        "status": data.get("status", "not active"),
        "display_order": data.get("display_order", 0),
        "logo": logo_path,
        "is_archived": False,
        "created_at": utcnow(),
        "updated_at": utcnow(),
    }
    result = db.platforms.insert_one(doc)
    doc["_id"] = result.inserted_id
    return Response(serialize_platform(doc, request), status=status.HTTP_201_CREATED)


@api_view(["GET", "PATCH", "DELETE"])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def platform_detail(request, platform_id):
    db = get_db()
    owner = owner_oid(request)
    platform_oid = oid(platform_id)
    if not platform_oid:
        return Response({"detail": "Invalid platform id."}, status=status.HTTP_400_BAD_REQUEST)
    doc = db.platforms.find_one({"_id": platform_oid, "owner_id": owner})
    if not doc:
        return Response({"detail": "Platform not found."}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "GET":
        return Response(serialize_platform(doc, request))

    if request.method == "DELETE":
        # Archive the platform instead of destroying historical income records.
        db.platforms.update_one({"_id": platform_oid, "owner_id": owner}, {"$set": {"is_archived": True, "updated_at": utcnow()}})
        return Response(status=status.HTTP_204_NO_CONTENT)

    serializer = PlatformSerializer(data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data
    updates = {"updated_at": utcnow()}
    for key in ("name", "website", "default_currency", "status", "display_order"):
        if key in data:
            updates[key] = data[key].strip() if isinstance(data[key], str) else data[key]
    if "default_currency" in updates:
        updates["default_currency"] = updates["default_currency"].upper()
    if data.get("logo"):
        delete_logo(doc.get("logo"))
        updates["logo"] = save_logo(data["logo"])
    db.platforms.update_one({"_id": platform_oid, "owner_id": owner}, {"$set": updates})
    doc.update(updates)
    return Response(serialize_platform(doc, request))


@api_view(["GET", "POST"])
def earnings(request):
    db = get_db()
    owner = owner_oid(request)
    if request.method == "GET":
        query = {"owner_id": owner}
        currency = request.query_params.get("currency")
        platform_id = request.query_params.get("platform_id")
        earning_status = request.query_params.get("status")
        year = request.query_params.get("year")
        page = max(int(request.query_params.get("page", 1)), 1)
        page_size = 8
        if currency:
            query["currency"] = currency.upper()
        if platform_id:
            p_oid = oid(platform_id)
            if p_oid:
                query["platform_id"] = p_oid
        if earning_status in {"paid", "pending"}:
            query["status"] = earning_status
        if year and year.isdigit():
            y = int(year)
            start = datetime(y, 1, 1, tzinfo=timezone.utc)
            end = datetime(y + 1, 1, 1, tzinfo=timezone.utc)
            query["earned_at"] = {"$gte": start, "$lt": end}

        search = request.query_params.get("search", "").strip()[:100]
        if search:
            safe_search = re.escape(search)
            matching_platform_ids = [
                platform["_id"]
                for platform in db.platforms.find(
                    {"owner_id": owner, "name": {"$regex": safe_search, "$options": "i"}},
                    {"_id": 1},
                )
            ]
            query["$or"] = [
                {"note": {"$regex": safe_search, "$options": "i"}},
                {"category": {"$regex": safe_search, "$options": "i"}},
                {"currency": {"$regex": safe_search, "$options": "i"}},
                {"platform_id": {"$in": matching_platform_ids}},
            ]
        total = db.earnings.count_documents(query)
        docs = list(db.earnings.find(query).sort("earned_at", DESCENDING).skip((page - 1) * page_size).limit(page_size))
        platform_ids = list({d.get("platform_id") for d in docs if d.get("platform_id")})
        pmap = {p["_id"]: p for p in db.platforms.find({"_id": {"$in": platform_ids}, "owner_id": owner})}
        rate = current_currency_rates()
        return Response({
            "results": [serialize_earning(d, pmap.get(d.get("platform_id")), rate) for d in docs],
            "pagination": {"page": page, "page_size": page_size, "total": total, "pages": max((total + page_size - 1) // page_size, 1)},
        })

    serializer = EarningSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data
    platform_oid = oid(data["platform_id"])
    platform = db.platforms.find_one({"_id": platform_oid, "owner_id": owner}) if platform_oid else None
    if not platform:
        return Response({"detail": "Platform not found."}, status=status.HTTP_400_BAD_REQUEST)
    earned_dt = datetime.combine(data["earned_at"], time.min, tzinfo=timezone.utc)
    expected_at = data.get("expected_at")
    expected_dt = (
        datetime.combine(expected_at, time.min, tzinfo=timezone.utc)
        if expected_at
        else None
    )
    doc = {
        "owner_id": owner,
        "platform_id": platform_oid,
        "amount": decimal128(data["amount"]),
        "platform_fee": decimal128(data.get("platform_fee", 0)),
        "payment_fee": decimal128(data.get("payment_fee", 0)),
        "currency": data["currency"].upper(),
        "status": data.get("status", "paid"),
        "earned_at": earned_dt,
        "expected_at": expected_dt,
        "note": data.get("note", "").strip(),
        "category": data.get("category", "").strip(),
        "created_at": utcnow(),
        "updated_at": utcnow(),
    }
    result = db.earnings.insert_one(doc)
    doc["_id"] = result.inserted_id
    return Response(serialize_earning(doc, platform, current_currency_rates()), status=status.HTTP_201_CREATED)


@api_view(["GET", "PATCH", "DELETE"])
def earning_detail(request, earning_id):
    db = get_db()
    owner = owner_oid(request)
    earning_oid = oid(earning_id)
    if not earning_oid:
        return Response({"detail": "Invalid earning id."}, status=status.HTTP_400_BAD_REQUEST)
    doc = db.earnings.find_one({"_id": earning_oid, "owner_id": owner})
    if not doc:
        return Response({"detail": "Earning not found."}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "DELETE":
        db.earnings.delete_one({"_id": earning_oid, "owner_id": owner})
        return Response(status=status.HTTP_204_NO_CONTENT)

    if request.method == "GET":
        platform = db.platforms.find_one({"_id": doc.get("platform_id"), "owner_id": owner})
        return Response(serialize_earning(doc, platform, current_currency_rates()))

    serializer = EarningSerializer(data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data
    updates = {"updated_at": utcnow()}
    platform = None
    if "platform_id" in data:
        p_oid = oid(data["platform_id"])
        platform = db.platforms.find_one({"_id": p_oid, "owner_id": owner}) if p_oid else None
        if not platform:
            return Response({"detail": "Platform not found."}, status=status.HTTP_400_BAD_REQUEST)
        updates["platform_id"] = p_oid
    if "amount" in data:
        updates["amount"] = decimal128(data["amount"])
    if "platform_fee" in data:
        updates["platform_fee"] = decimal128(data["platform_fee"])
    if "payment_fee" in data:
        updates["payment_fee"] = decimal128(data["payment_fee"])
    if "currency" in data:
        updates["currency"] = data["currency"].upper()
    if "status" in data:
        updates["status"] = data["status"]
    if "earned_at" in data:
        updates["earned_at"] = datetime.combine(data["earned_at"], time.min, tzinfo=timezone.utc)
    if "expected_at" in data:
        updates["expected_at"] = (
            datetime.combine(data["expected_at"], time.min, tzinfo=timezone.utc)
            if data["expected_at"]
            else None
        )
    for key in ("note", "category"):
        if key in data:
            updates[key] = data[key].strip()

    db.earnings.update_one({"_id": earning_oid, "owner_id": owner}, {"$set": updates})
    doc.update(updates)
    if platform is None:
        platform = db.platforms.find_one({"_id": doc.get("platform_id"), "owner_id": owner})
    return Response(serialize_earning(doc, platform, current_currency_rates()))


@api_view(["GET", "PUT"])
def income_goals(request):
    db = get_db()
    owner = owner_oid(request)

    if request.method == "GET":
        doc = db.income_goals.find_one({"owner_id": owner}) or {}
        return Response({
            "monthly_goal": decimal_to_float(doc.get("monthly_goal")),
            "yearly_goal": decimal_to_float(doc.get("yearly_goal")),
            "currency": doc.get("currency", "USD"),
        })

    serializer = GoalSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data

    updates = {
        "monthly_goal": decimal128(data["monthly_goal"]),
        "yearly_goal": decimal128(data["yearly_goal"]),
        "currency": data["currency"],
        "updated_at": utcnow(),
    }

    db.income_goals.update_one(
        {"owner_id": owner},
        {"$set": updates, "$setOnInsert": {"created_at": utcnow()}},
        upsert=True,
    )

    return Response({
        "monthly_goal": float(data["monthly_goal"]),
        "yearly_goal": float(data["yearly_goal"]),
        "currency": data["currency"],
    })


@api_view(["GET"])
def export_earnings_csv(request):
    db = get_db()
    owner = owner_oid(request)
    rates = current_currency_rates()
    docs = list(db.earnings.find({"owner_id": owner}).sort("earned_at", DESCENDING))
    platform_ids = list({doc.get("platform_id") for doc in docs if doc.get("platform_id")})
    pmap = {
        platform["_id"]: platform
        for platform in db.platforms.find(
            {"owner_id": owner, "_id": {"$in": platform_ids}}
        )
    }

    response = HttpResponse(content_type="text/csv; charset=utf-8")
    response["Content-Disposition"] = 'attachment; filename="revnivo-earnings.csv"'
    writer = csv.writer(response)
    writer.writerow([
        "Platform",
        "Gross amount",
        "Platform fee",
        "Payment fee",
        "Net amount",
        "Currency",
        "Status",
        "Date earned",
        "Expected date",
        "Category",
        "Description",
    ])

    for doc in docs:
        item = serialize_earning(doc, pmap.get(doc.get("platform_id")), rates)
        writer.writerow([
            item["platform_name"],
            item["gross_amount"],
            item["platform_fee"],
            item["payment_fee"],
            item["net_amount"],
            item["currency"],
            item["status"],
            item["earned_at"],
            item["expected_at"],
            item["category"],
            item["note"],
        ])

    return response


@api_view(["POST"])
@parser_classes([MultiPartParser, FormParser])
def import_earnings_csv(request):
    db = get_db()
    owner = owner_oid(request)
    uploaded = request.FILES.get("file")

    if not uploaded:
        return Response({"detail": "Choose a CSV file."}, status=status.HTTP_400_BAD_REQUEST)
    if uploaded.size > 2 * 1024 * 1024:
        return Response({"detail": "CSV file must be 2 MB or smaller."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        raw = uploaded.read().decode("utf-8-sig")
    except UnicodeDecodeError:
        return Response({"detail": "CSV must use UTF-8 encoding."}, status=status.HTTP_400_BAD_REQUEST)

    reader = csv.DictReader(StringIO(raw))
    required = {"Platform", "Gross amount", "Currency", "Date earned", "Category"}
    if not reader.fieldnames or not required.issubset(set(reader.fieldnames)):
        return Response(
            {"detail": "CSV columns must include Platform, Gross amount, Currency, Date earned, and Category."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    platforms = {
        platform.get("name", "").strip().lower(): platform
        for platform in db.platforms.find({"owner_id": owner, "is_archived": {"$ne": True}})
    }

    inserted = 0
    skipped = 0
    errors = []

    for row_number, row in enumerate(reader, start=2):
        platform_name = str(row.get("Platform", "")).strip()
        platform = platforms.get(platform_name.lower())

        if not platform:
            skipped += 1
            errors.append(f"Row {row_number}: platform '{platform_name}' was not found.")
            continue

        payload = {
            "platform_id": str(platform["_id"]),
            "amount": row.get("Gross amount", ""),
            "platform_fee": row.get("Platform fee") or 0,
            "payment_fee": row.get("Payment fee") or 0,
            "currency": row.get("Currency", ""),
            "status": "pending" if str(row.get("Status", "")).strip().lower() in {"pending", "overdue"} else "paid",
            "earned_at": row.get("Date earned", ""),
            "expected_at": row.get("Expected date") or None,
            "category": row.get("Category", ""),
            "note": row.get("Description", ""),
        }

        serializer = EarningSerializer(data=payload)
        if not serializer.is_valid():
            skipped += 1
            errors.append(f"Row {row_number}: invalid data.")
            continue

        data = serializer.validated_data
        expected_at = data.get("expected_at")
        db.earnings.insert_one({
            "owner_id": owner,
            "platform_id": platform["_id"],
            "amount": decimal128(data["amount"]),
            "platform_fee": decimal128(data.get("platform_fee", 0)),
            "payment_fee": decimal128(data.get("payment_fee", 0)),
            "currency": data["currency"],
            "status": data.get("status", "paid"),
            "earned_at": datetime.combine(data["earned_at"], time.min, tzinfo=timezone.utc),
            "expected_at": datetime.combine(expected_at, time.min, tzinfo=timezone.utc) if expected_at else None,
            "category": data["category"].strip(),
            "note": data.get("note", "").strip(),
            "created_at": utcnow(),
            "updated_at": utcnow(),
        })
        inserted += 1

    return Response({
        "inserted": inserted,
        "skipped": skipped,
        "errors": errors[:20],
    })


@api_view(["GET"])
def dashboard(request):
    db = get_db()
    owner = owner_oid(request)
    currency = request.query_params.get("currency", "USD").upper()
    year = request.query_params.get("year", "all")
    period = request.query_params.get("period", "all")
    date_from = request.query_params.get("date_from", "")
    date_to = request.query_params.get("date_to", "")
    platform_id = request.query_params.get("platform_id", "all")
    rates = current_currency_rates()

    match = {
        "owner_id": owner,
        "$or": [
            {"status": "paid"},
            {"status": {"$exists": False}},
        ],
        **dashboard_currency_query(currency),
    }
    if platform_id != "all":
        platform_oid = oid(platform_id)
        if platform_oid and db.platforms.find_one({"_id": platform_oid, "owner_id": owner, "is_archived": {"$ne": True}}):
            match["platform_id"] = platform_oid
        else:
            platform_id = "all"
    if period in {"last_week", "last_month", "last_3_months", "last_year"}:
        now = datetime.now(timezone.utc)
        current_week_start = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
        current_month_start = datetime(now.year, now.month, 1, tzinfo=timezone.utc)
        previous_month_start = datetime(now.year if now.month > 1 else now.year - 1, now.month - 1 if now.month > 1 else 12, 1, tzinfo=timezone.utc)
        previous_three_months_start = datetime(now.year if now.month > 3 else now.year - 1, now.month - 3 if now.month > 3 else now.month + 9, 1, tzinfo=timezone.utc)

        try:
            one_year_ago = now.replace(year=now.year - 1)
        except ValueError:
            # Feb 29 -> Feb 28 in a non-leap previous year.
            one_year_ago = now.replace(year=now.year - 1, day=28)

        if period == "last_week":
            match["earned_at"] = {"$gte": current_week_start - timedelta(days=7), "$lt": current_week_start}
        elif period == "last_month":
            match["earned_at"] = {"$gte": previous_month_start, "$lt": current_month_start}
        elif period == "last_3_months":
            match["earned_at"] = {"$gte": previous_three_months_start, "$lt": current_month_start}
        else:
            # Rolling year: same date/time last year through right now.
            match["earned_at"] = {"$gte": one_year_ago, "$lte": now}
    elif period == "custom" and date_from and date_to:
        try:
            start = datetime.fromisoformat(date_from).replace(tzinfo=timezone.utc)
            end = datetime.fromisoformat(date_to).replace(tzinfo=timezone.utc) + timedelta(days=1)
            if start < end:
                match["earned_at"] = {"$gte": start, "$lt": end}
        except ValueError:
            period = "all"
    elif year != "all" and str(year).isdigit():
        y = int(year)
        match["earned_at"] = {
            "$gte": datetime(y, 1, 1, tzinfo=timezone.utc),
            "$lt": datetime(y + 1, 1, 1, tzinfo=timezone.utc),
        }

    now = datetime.now(timezone.utc)
    current_month_start = datetime(now.year, now.month, 1, tzinfo=timezone.utc)
    next_month_start = datetime(now.year + (1 if now.month == 12 else 0), 1 if now.month == 12 else now.month + 1, 1, tzinfo=timezone.utc)
    previous_month_start = datetime(now.year if now.month > 1 else now.year - 1, now.month - 1 if now.month > 1 else 12, 1, tzinfo=timezone.utc)
    paid_status_match = {
        "$or": [
            {"status": "paid"},
            {"status": {"$exists": False}},
        ]
    }
    current_month_match = {
        "owner_id": owner,
        **paid_status_match,
        **dashboard_currency_query(currency),
        "earned_at": {"$gte": current_month_start, "$lt": next_month_start},
    }
    previous_month_match = {
        "owner_id": owner,
        **paid_status_match,
        **dashboard_currency_query(currency),
        "earned_at": {"$gte": previous_month_start, "$lt": current_month_start},
    }
    if "platform_id" in match:
        current_month_match["platform_id"] = match["platform_id"]
        previous_month_match["platform_id"] = match["platform_id"]

    def month_total(month_match):
        result = next(db.earnings.aggregate([
            {"$match": month_match},
            {"$group": {"_id": None, "total": {"$sum": dashboard_amount_expression(currency, rates)}}},
        ]), None)
        return decimal_to_float(result["total"]) if result else 0.0

    current_month_income = month_total(current_month_match)
    previous_month_income = month_total(previous_month_match)

    total_doc = next(db.earnings.aggregate([
        {"$match": match},
        {
            "$group": {
                "_id": None,
                "total": {"$sum": dashboard_amount_expression(currency, rates)},
                "net_total": {"$sum": dashboard_net_expression(currency, rates)},
                "count": {"$sum": 1},
            }
        },
    ]), None)
    total = decimal_to_float(total_doc.get("total")) if total_doc else 0.0
    net_total = decimal_to_float(total_doc.get("net_total")) if total_doc else 0.0
    count = total_doc.get("count", 0) if total_doc else 0

    monthly = list(db.earnings.aggregate([
        {"$match": match},
        {"$group": {
            "_id": {"year": {"$year": "$earned_at"}, "month": {"$month": "$earned_at"}},
            "total": {"$sum": dashboard_amount_expression(currency, rates)},
        }},
        {"$sort": {"_id.year": 1, "_id.month": 1}},
    ]))

    monthly_platform_rows = list(db.earnings.aggregate([
        {"$match": match},
        {"$group": {
            "_id": {
                "year": {"$year": "$earned_at"},
                "month": {"$month": "$earned_at"},
                "platform_id": "$platform_id",
            },
            "total": {"$sum": dashboard_amount_expression(currency, rates)},
        }},
        {"$sort": {"_id.year": 1, "_id.month": 1}},
    ]))

    yearly = list(db.earnings.aggregate([
        {"$match": {**match, **dashboard_currency_query(currency)}},
        {"$group": {
            "_id": {"year": {"$year": "$earned_at"}, "month": {"$month": "$earned_at"}},
            "total": {"$sum": dashboard_amount_expression(currency, rates)},
        }},
        {"$sort": {"_id.year": 1, "_id.month": 1}},
    ]))

    by_platform = list(db.earnings.aggregate([
        {"$match": match},
        {"$group": {"_id": "$platform_id", "total": {"$sum": dashboard_amount_expression(currency, rates)}, "count": {"$sum": 1}}},
        {"$sort": {"total": -1}},
    ]))
    pids = [x["_id"] for x in by_platform if x.get("_id")]
    pmap = {p["_id"]: p for p in db.platforms.find({"_id": {"$in": pids}, "owner_id": owner})}
    platform_breakdown = [
        {
            "platform_id": str(row["_id"]),
            "name": pmap.get(row["_id"], {}).get("name", "Deleted platform"),
            "total": decimal_to_float(row["total"]),
            "count": row["count"],
        }
        for row in by_platform
    ]
    monthly_platform_map = {}
    for row in monthly_platform_rows:
        key = (row["_id"]["year"], row["_id"]["month"])
        platform_key = str(row["_id"]["platform_id"])
        monthly_platform_map.setdefault(key, {"year": key[0], "month": key[1]})[platform_key] = decimal_to_float(row["total"])
    monthly_by_platform = list(monthly_platform_map.values())

    recent_docs = list(db.earnings.find(match).sort("earned_at", DESCENDING).limit(6))
    recent_pids = list({d.get("platform_id") for d in recent_docs if d.get("platform_id")})
    recent_pmap = {p["_id"]: p for p in db.platforms.find({"_id": {"$in": recent_pids}, "owner_id": owner})}

    pending_match = {
        "owner_id": owner,
        "status": "pending",
        **dashboard_currency_query(currency),
    }
    if "platform_id" in match:
        pending_match["platform_id"] = match["platform_id"]

    pending_doc = next(db.earnings.aggregate([
        {"$match": pending_match},
        {
            "$group": {
                "_id": None,
                "total": {"$sum": dashboard_amount_expression(currency, rates)},
                "net_total": {"$sum": dashboard_net_expression(currency, rates)},
                "count": {"$sum": 1},
            }
        },
    ]), None)
    pending_total = decimal_to_float(pending_doc.get("total")) if pending_doc else 0.0
    pending_net_total = decimal_to_float(pending_doc.get("net_total")) if pending_doc else 0.0
    pending_count = pending_doc.get("count", 0) if pending_doc else 0

    overdue_count = db.earnings.count_documents({
        "owner_id": owner,
        "status": "pending",
        "expected_at": {"$lt": now},
    })

    goal_doc = db.income_goals.find_one({"owner_id": owner}) or {}
    goal_currency = goal_doc.get("currency", currency)
    source_rate = rates.get(goal_currency)
    target_rate = rates.get(currency)

    def convert_goal(value):
        raw = decimal_to_float(value)
        if not raw or not source_rate or not target_rate:
            return raw
        return raw * float(target_rate / source_rate)

    monthly_goal = convert_goal(goal_doc.get("monthly_goal"))
    yearly_goal = convert_goal(goal_doc.get("yearly_goal"))

    year_start = datetime(now.year, 1, 1, tzinfo=timezone.utc)
    year_paid_match = {
        "owner_id": owner,
        **paid_status_match,
        **dashboard_currency_query(currency),
        "earned_at": {"$gte": year_start, "$lt": datetime(now.year + 1, 1, 1, tzinfo=timezone.utc)},
    }
    if "platform_id" in match:
        year_paid_match["platform_id"] = match["platform_id"]

    year_total_doc = next(db.earnings.aggregate([
        {"$match": year_paid_match},
        {"$group": {"_id": None, "total": {"$sum": dashboard_net_expression(currency, rates)}}},
    ]), None)
    current_year_net = decimal_to_float(year_total_doc.get("total")) if year_total_doc else 0.0

    current_month_net_doc = next(db.earnings.aggregate([
        {"$match": current_month_match},
        {"$group": {"_id": None, "total": {"$sum": dashboard_net_expression(currency, rates)}}},
    ]), None)
    current_month_net = decimal_to_float(current_month_net_doc.get("total")) if current_month_net_doc else 0.0

    insights = []
    if previous_month_income > 0:
        change = ((current_month_income - previous_month_income) / previous_month_income) * 100
        direction = "increased" if change >= 0 else "decreased"
        insights.append(
            f"Your income {direction} {abs(change):.1f}% compared with last month."
        )
    elif current_month_income > 0:
        insights.append("You recorded income this month after no paid income last month.")

    if platform_breakdown and total > 0:
        top = platform_breakdown[0]
        share = (top["total"] / total) * 100 if total else 0
        insights.append(
            f"{top['name']} generated {share:.0f}% of the income in your current view."
        )

    if pending_count:
        insights.append(
            f"You have {pending_count} pending payment{'s' if pending_count != 1 else ''} worth {pending_net_total:,.2f} {currency} net."
        )

    if overdue_count:
        insights.append(
            f"{overdue_count} pending payment{'s are' if overdue_count != 1 else ' is'} overdue."
        )

    if monthly_goal > 0:
        progress = min((current_month_net / monthly_goal) * 100, 100)
        insights.append(f"You are {progress:.0f}% toward your monthly income goal.")

    currencies = sorted(set(db.earnings.distinct("currency", {"owner_id": owner})) | {"EGP"})
    year_rows = list(db.earnings.aggregate([
        {"$match": {"owner_id": owner}},
        {"$group": {"_id": {"$year": "$earned_at"}}},
        {"$sort": {"_id": -1}},
    ]))
    years = [r["_id"] for r in year_rows]
    platform_rows = db.platforms.find(
        {"owner_id": owner, "is_archived": {"$ne": True}},
        {"name": 1},
    ).sort("name", ASCENDING)
    platforms = [{"id": str(p["_id"]), "name": p.get("name", "")} for p in platform_rows]

    return Response({
        "currency": currency,
        "year": year,
        "period": period,
        "date_from": date_from if period == "custom" else None,
        "date_to": date_to if period == "custom" else None,
        "platform_id": platform_id,
        "exchange_rate": float(rates[currency]) if currency in rates else None,
        "summary": {
            "total_income": total,
            "net_income": net_total,
            "pending_income": pending_total,
            "pending_net_income": pending_net_total,
            "pending_count": pending_count,
            "overdue_count": overdue_count,
            "transactions": count,
            "platforms": db.platforms.count_documents({"owner_id": owner, "is_archived": {"$ne": True}}),
            "best_platform": platform_breakdown[0]["name"] if platform_breakdown else None,
            "best_platform_total": platform_breakdown[0]["total"] if platform_breakdown else 0,
            "current_month_income": current_month_income,
            "previous_month_income": previous_month_income,
        },
        "monthly": [
            {"year": r["_id"]["year"], "month": r["_id"]["month"], "total": decimal_to_float(r["total"])}
            for r in monthly
        ],
        "monthly_by_platform": monthly_by_platform,
        "yearly": [
            {"year": r["_id"]["year"], "month": r["_id"]["month"], "total": decimal_to_float(r["total"])}
            for r in yearly
        ],
        "platform_breakdown": platform_breakdown,
        "recent": [serialize_earning(d, recent_pmap.get(d.get("platform_id")), rates) for d in recent_docs],
        "goals": {
            "monthly_goal": monthly_goal,
            "yearly_goal": yearly_goal,
            "current_month_net": current_month_net,
            "current_year_net": current_year_net,
            "currency": currency,
        },
        "insights": insights[:5],
        "filters": {"currencies": currencies, "years": years, "platforms": platforms},
    })
