from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
import hmac
import secrets

import jwt
from bson import ObjectId
from django.conf import settings
from rest_framework import authentication, exceptions

from .mongo import get_db


@dataclass
class MongoUser:
    id: str
    email: str
    name: str

    @property
    def is_authenticated(self):
        return True

    @property
    def is_anonymous(self):
        return False


def create_access_token(user_id: str, email: str, token_version: int = 0):
    now = datetime.now(timezone.utc)
    csrf_token = secrets.token_urlsafe(32)
    payload = {
        "sub": user_id,
        "email": email,
        "iat": now,
        "exp": now + timedelta(minutes=settings.JWT_EXP_MINUTES),
        "jti": secrets.token_urlsafe(24),
        "ver": int(token_version or 0),
        "csrf": csrf_token,
        "iss": settings.JWT_ISSUER,
        "aud": settings.JWT_AUDIENCE,
    }
    token = jwt.encode(
        payload,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )
    return token, csrf_token


def set_auth_cookies(response, token: str, csrf_token: str):
    common = {
        "max_age": settings.JWT_EXP_MINUTES * 60,
        "secure": settings.AUTH_COOKIE_SECURE,
        "samesite": settings.AUTH_COOKIE_SAMESITE,
        "path": "/",
    }
    if settings.AUTH_COOKIE_DOMAIN:
        common["domain"] = settings.AUTH_COOKIE_DOMAIN

    response.set_cookie(
        settings.AUTH_COOKIE_NAME,
        token,
        httponly=True,
        **common,
    )
    response.set_cookie(
        settings.AUTH_CSRF_COOKIE_NAME,
        csrf_token,
        httponly=False,
        **common,
    )
    response["X-CSRF-Token"] = csrf_token


def clear_auth_cookies(response):
    response.delete_cookie(
        settings.AUTH_COOKIE_NAME,
        path="/",
        domain=settings.AUTH_COOKIE_DOMAIN or None,
        samesite=settings.AUTH_COOKIE_SAMESITE,
    )
    response.delete_cookie(
        settings.AUTH_CSRF_COOKIE_NAME,
        path="/",
        domain=settings.AUTH_COOKIE_DOMAIN or None,
        samesite=settings.AUTH_COOKIE_SAMESITE,
    )


class MongoJWTAuthentication(authentication.BaseAuthentication):
    keyword = "Bearer"
    safe_methods = {"GET", "HEAD", "OPTIONS"}

    def authenticate(self, request):
        header = authentication.get_authorization_header(request).decode("utf-8")
        token = None
        using_cookie = False

        if header:
            parts = header.split()
            if len(parts) != 2 or parts[0].lower() != self.keyword.lower():
                raise exceptions.AuthenticationFailed("Invalid authorization header.")
            token = parts[1]
        else:
            token = request.COOKIES.get(settings.AUTH_COOKIE_NAME)
            using_cookie = bool(token)

        if not token:
            return None

        try:
            payload = jwt.decode(
                token,
                settings.JWT_SECRET_KEY,
                algorithms=[settings.JWT_ALGORITHM],
                audience=settings.JWT_AUDIENCE,
                issuer=settings.JWT_ISSUER,
                options={
                    "require": ["exp", "iat", "sub", "jti", "iss", "aud"],
                },
            )
            user_id = payload.get("sub")
            if not user_id or not ObjectId.is_valid(user_id):
                raise exceptions.AuthenticationFailed("Invalid token subject.")

            doc = get_db().users.find_one({"_id": ObjectId(user_id)})
            if not doc:
                raise exceptions.AuthenticationFailed("User not found.")

            if int(payload.get("ver", -1)) != int(doc.get("token_version", 0)):
                raise exceptions.AuthenticationFailed("Session has been revoked.")

            token_csrf = str(payload.get("csrf") or "")
            request.revnivo_csrf = token_csrf
            underlying_request = getattr(request, "_request", None)
            if underlying_request is not None:
                underlying_request.revnivo_csrf = token_csrf

            if using_cookie and request.method.upper() not in self.safe_methods:
                header_csrf = request.headers.get("X-CSRF-Token", "")
                cookie_csrf = request.COOKIES.get(settings.AUTH_CSRF_COOKIE_NAME, "")
                if not (
                    header_csrf
                    and token_csrf
                    and cookie_csrf
                    and hmac.compare_digest(header_csrf, token_csrf)
                    and hmac.compare_digest(cookie_csrf, token_csrf)
                ):
                    raise exceptions.AuthenticationFailed("CSRF validation failed.")

        except jwt.ExpiredSignatureError as exc:
            raise exceptions.AuthenticationFailed("Session expired.") from exc
        except jwt.InvalidTokenError as exc:
            raise exceptions.AuthenticationFailed("Invalid session.") from exc

        user = MongoUser(
            id=str(doc["_id"]),
            email=doc["email"],
            name=doc.get("name", ""),
        )
        return (user, token)
