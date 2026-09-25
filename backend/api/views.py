from datetime import datetime, time, timedelta, timezone
from decimal import Decimal
import base64
import binascii
import json
import secrets
from time import monotonic
from urllib.request import urlopen

from bson import ObjectId
from bson.decimal128 import Decimal128
from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from django.core.mail import EmailMultiAlternatives
from html import escape
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from pymongo import ASCENDING, DESCENDING
from pymongo.errors import DuplicateKeyError, PyMongoError
from rest_framework import status
from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .authentication import create_access_token
from .mongo import ensure_indexes, get_db
from .serializers import EarningSerializer, LoginSerializer, PlatformSerializer, RegisterSerializer
from .utils import (
    decimal128,
    decimal_to_float,
    delete_logo,
    oid,
    save_logo,
    save_upload,
    serialize_datetime,
    serialize_note,
    serialize_earning,
    serialize_platform,
    utcnow,
)


def owner_oid(request):
    return ObjectId(request.user.id)


ADMIN_EMAIL = "dev.shehabsaid@gmail.com"
SUPERADMIN_EMAIL = ADMIN_EMAIL


def is_admin_doc(doc):
    return bool(doc and (doc.get("role") == "admin" or doc.get("email", "").lower() == ADMIN_EMAIL))


def is_superadmin_doc(doc):
    return bool(doc and doc.get("email", "").lower() == SUPERADMIN_EMAIL)


def serialize_user(doc, request):
    avatar = doc.get("profile_image") or ""
    avatar_url = ""
    if avatar:
        path = f"{settings.MEDIA_URL}{avatar}".replace("//", "/")
        avatar_url = request.build_absolute_uri(path)

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
        "role": "admin" if email.lower() == ADMIN_EMAIL else "user",
        "created_at": now,
        "trial_ends_at": now + timedelta(days=30),
        "subscription_status": "trial",
        "payment_method": None,
    }


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


@api_view(["GET"])
@permission_classes([AllowAny])
def health(request):
    try:
        get_db().command("ping")
        mongo = "ok"
    except Exception:
        mongo = "unavailable"
    return Response({"status": "ok", "mongodb": mongo})


@api_view(["POST"])
@permission_classes([AllowAny])
def register(request):
    serializer = RegisterSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data
    db = get_db()
    ensure_indexes()
    email = data["email"].strip().lower()
    try:
        result = db.users.insert_one(create_user_doc(data["name"].strip(), email, make_password(data["password"])))
    except DuplicateKeyError:
        return Response({"detail": "An account with this email already exists."}, status=status.HTTP_409_CONFLICT)
    doc = {"_id": result.inserted_id, "name": data["name"].strip(), "email": email}
    admin_doc = db.users.find_one({"email": ADMIN_EMAIL}, {"_id": 1})
    create_notification("user", "New user registered", f"{email} created a Revnivo account.", admin_doc["_id"] if admin_doc else None)
    token = create_access_token(str(result.inserted_id), email)
    return Response({
        "token": token,
        "user": serialize_user(doc, request),
    }, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([AllowAny])
def login(request):
    serializer = LoginSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    email = serializer.validated_data["email"].strip().lower()
    doc = get_db().users.find_one({"email": email})
    if not doc or not check_password(serializer.validated_data["password"], doc.get("password_hash", "")):
        return Response({"detail": "Invalid email or password."}, status=status.HTTP_401_UNAUTHORIZED)
    token = create_access_token(str(doc["_id"]), email)
    return Response({"token": token, "user": serialize_user(doc, request)})


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

    code = f"{secrets.randbelow(1_000_000):06d}"
    now = utcnow()
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
def reset_password(request):
    email = str(request.data.get("email", "")).strip().lower()
    code = str(request.data.get("code", "")).strip()
    password = str(request.data.get("password", ""))
    if not email or not code or not password:
        return Response({"detail": "Email, verification code, and new password are required."}, status=status.HTTP_400_BAD_REQUEST)
    if len(code) != 6 or not code.isdigit():
        return Response({"detail": "Enter the 6-digit verification code."}, status=status.HTTP_400_BAD_REQUEST)
    if len(password) < 8:
        return Response({"detail": "Password must contain at least 8 characters."}, status=status.HTTP_400_BAD_REQUEST)

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

    result = db.users.update_one({"email": email}, {"$set": {"password_hash": make_password(password), "auth_provider": "password", "updated_at": utcnow()}})
    db.password_reset_otps.delete_one({"_id": reset["_id"]})
    if not result.matched_count:
        return Response({"detail": "Unable to reset this password."}, status=status.HTTP_400_BAD_REQUEST)
    return Response({"detail": "Password reset successfully."})


@api_view(["POST"])
@permission_classes([AllowAny])
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
        admin_doc = db.users.find_one({"email": ADMIN_EMAIL}, {"_id": 1})
        create_notification("user", "New user registered", f"{email} created a Revnivo account.", admin_doc["_id"] if admin_doc else None)

    if google_user.get("picture") and doc.get("google_picture") != google_user["picture"]:
        db.users.update_one({"_id": doc["_id"]}, {"$set": {"google_picture": google_user["picture"]}})
        doc["google_picture"] = google_user["picture"]

    token = create_access_token(str(doc["_id"]), email)
    return Response({"token": token, "user": serialize_user(doc, request)})


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
        "users": [serialize_user(doc, request) for doc in docs],
    })


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
        try:
            price = round(float(request.data.get("price", 0)), 2)
            trial_days = max(int(request.data.get("trial_days", 30)), 0)
        except (TypeError, ValueError):
            return Response({"detail": "Invalid plan values."}, status=status.HTTP_400_BAD_REQUEST)
        if not name or price <= 0:
            return Response({"detail": "Plan name and positive price are required."}, status=status.HTTP_400_BAD_REQUEST)
        now = utcnow()
        result = db.subscription_plans.insert_one({"name": name[:100], "price": price, "trial_days": trial_days, "active": True, "created_at": now, "updated_at": now})
        return Response({"id": str(result.inserted_id), "name": name[:100], "price": price, "trial_days": trial_days, "active": True}, status=status.HTTP_201_CREATED)
    if request.method in ("PATCH", "DELETE"):
        plan_id = oid(request.data.get("id"))
        if not plan_id:
            return Response({"detail": "Invalid plan id."}, status=status.HTTP_400_BAD_REQUEST)
        if request.method == "DELETE":
            db.subscription_plans.delete_one({"_id": plan_id})
            return Response(status=status.HTTP_204_NO_CONTENT)
        updates = {key: request.data[key] for key in ("name", "price", "trial_days", "active") if key in request.data}
        if "price" in updates: updates["price"] = round(float(updates["price"]), 2)
        updates["updated_at"] = utcnow()
        db.subscription_plans.update_one({"_id": plan_id}, {"$set": updates})
    plans = []
    for plan in db.subscription_plans.find({}).sort("created_at", DESCENDING):
        plans.append({"id": str(plan["_id"]), "name": plan.get("name", ""), "price": float(plan.get("price", 0)), "trial_days": plan.get("trial_days", 0), "active": plan.get("active", True)})
    coupons = []
    for coupon in db.subscription_coupons.find({}).sort("created_at", DESCENDING):
        coupons.append({"id": str(coupon["_id"]), "code": coupon.get("code", ""), "discount_type": coupon.get("discount_type", "percent"), "discount_value": coupon.get("discount_value", 0), "active": coupon.get("active", True)})
    return Response({"plans": plans, "coupons": coupons})


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
        message_id = oid(request.data.get("id"))
        if not message_id:
            return Response({"detail": "Invalid message id."}, status=status.HTTP_400_BAD_REQUEST)
        message = db.chat_messages.find_one({"_id": message_id})
        if not message:
            return Response({"detail": "Message not found."}, status=status.HTTP_404_NOT_FOUND)
        if request.data.get("mode") == "everyone":
            db.chat_messages.update_one({"_id": message_id}, {"$set": {"deleted": True, "content": "", "attachment": ""}})
        else:
            db.chat_messages.update_one({"_id": message_id}, {"$addToSet": {"deleted_for": owner}})
        return Response({"status": "deleted"})
    if request.method == "GET" and is_admin_doc(user_doc) and request.query_params.get("summary"):
        users = [doc for doc in db.users.find({"role": {"$ne": "admin"}}).sort("created_at", DESCENDING)]
        summaries = []
        for contact in users:
            contact_id = contact["_id"]
            latest = db.chat_messages.find_one({"user_id": contact_id}, sort=[("created_at", DESCENDING)])
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
            latest_message = ""
            if latest:
                latest_message = "Voice message" if latest.get("message_type") == "audio" else latest.get("content", "")
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
        message = {"user_id": target_user, "content": content[:2000], "message_type": str(request.data.get("message_type", "text")), "sender": "admin" if is_admin_doc(user_doc) else "user", "created_at": utcnow()}
        if attachment:
            message["attachment"] = save_upload(attachment, "chat")
        db.chat_messages.insert_one(message)
        if message["sender"] == "user":
            admin_ids = [admin["_id"] for admin in db.users.find({"$or": [{"role": "admin"}, {"email": ADMIN_EMAIL}]}, {"_id": 1})]
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
        result.append({**{key: doc.get(key) for key in ("content", "sender", "message_type")}, "deleted": bool(doc.get("deleted")), "id": str(doc["_id"]), "user_id": str(doc["user_id"]), "created_at": serialize_datetime(doc.get("created_at")), "attachment_url": request.build_absolute_uri(f"{settings.MEDIA_URL}{attachment}") if attachment else ""})
    return Response(result)


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
        search = request.query_params.get("search", "").strip()
        if search:
            query["$or"] = [
                {"title": {"$regex": search, "$options": "i"}},
                {"content": {"$regex": search, "$options": "i"}},
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
        year = request.query_params.get("year")
        page = max(int(request.query_params.get("page", 1)), 1)
        page_size = 8
        if currency:
            query["currency"] = currency.upper()
        if platform_id:
            p_oid = oid(platform_id)
            if p_oid:
                query["platform_id"] = p_oid
        if year and year.isdigit():
            y = int(year)
            start = datetime(y, 1, 1, tzinfo=timezone.utc)
            end = datetime(y + 1, 1, 1, tzinfo=timezone.utc)
            query["earned_at"] = {"$gte": start, "$lt": end}

        search = request.query_params.get("search", "").strip()
        if search:
            matching_platform_ids = [platform["_id"] for platform in db.platforms.find({"owner_id": owner, "name": {"$regex": search, "$options": "i"}}, {"_id": 1})]
            query["$or"] = [
                {"note": {"$regex": search, "$options": "i"}},
                {"category": {"$regex": search, "$options": "i"}},
                {"currency": {"$regex": search, "$options": "i"}},
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
    doc = {
        "owner_id": owner,
        "platform_id": platform_oid,
        "amount": decimal128(data["amount"]),
        "currency": data["currency"].upper(),
        "earned_at": earned_dt,
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
    if "currency" in data:
        updates["currency"] = data["currency"].upper()
    if "earned_at" in data:
        updates["earned_at"] = datetime.combine(data["earned_at"], time.min, tzinfo=timezone.utc)
    for key in ("note", "category"):
        if key in data:
            updates[key] = data[key].strip()

    db.earnings.update_one({"_id": earning_oid, "owner_id": owner}, {"$set": updates})
    doc.update(updates)
    if platform is None:
        platform = db.platforms.find_one({"_id": doc.get("platform_id"), "owner_id": owner})
    return Response(serialize_earning(doc, platform, current_currency_rates()))


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

    match = {"owner_id": owner, **dashboard_currency_query(currency)}
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
        current_year_start = datetime(now.year, 1, 1, tzinfo=timezone.utc)
        previous_month_start = datetime(now.year if now.month > 1 else now.year - 1, now.month - 1 if now.month > 1 else 12, 1, tzinfo=timezone.utc)
        previous_three_months_start = datetime(now.year if now.month > 3 else now.year - 1, now.month - 3 if now.month > 3 else now.month + 9, 1, tzinfo=timezone.utc)
        previous_year_start = datetime(now.year - 1, 1, 1, tzinfo=timezone.utc)
        if period == "last_week":
            match["earned_at"] = {"$gte": current_week_start - timedelta(days=7), "$lt": current_week_start}
        elif period == "last_month":
            match["earned_at"] = {"$gte": previous_month_start, "$lt": current_month_start}
        elif period == "last_3_months":
            match["earned_at"] = {"$gte": previous_three_months_start, "$lt": current_month_start}
        else:
            match["earned_at"] = {"$gte": previous_year_start, "$lt": current_year_start}
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
    current_month_match = {"owner_id": owner, **dashboard_currency_query(currency), "earned_at": {"$gte": current_month_start, "$lt": next_month_start}}
    previous_month_match = {"owner_id": owner, **dashboard_currency_query(currency), "earned_at": {"$gte": previous_month_start, "$lt": current_month_start}}
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
        {"$group": {"_id": None, "total": {"$sum": dashboard_amount_expression(currency, rates)}, "count": {"$sum": 1}}},
    ]), None)
    total = decimal_to_float(total_doc.get("total")) if total_doc else 0.0
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
        "recent": [serialize_earning(d, None if platform_id != "all" else recent_pmap.get(d.get("platform_id")), rates) for d in recent_docs],
        "filters": {"currencies": currencies, "years": years, "platforms": platforms},
    })
