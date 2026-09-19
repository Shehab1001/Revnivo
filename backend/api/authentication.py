from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

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


def create_access_token(user_id: str, email: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "email": email,
        "iat": now,
        "exp": now + timedelta(minutes=settings.JWT_EXP_MINUTES),
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


class MongoJWTAuthentication(authentication.BaseAuthentication):
    keyword = "Bearer"

    def authenticate(self, request):
        header = authentication.get_authorization_header(request).decode("utf-8")
        if not header:
            return None

        parts = header.split()
        if len(parts) != 2 or parts[0].lower() != self.keyword.lower():
            raise exceptions.AuthenticationFailed("Invalid authorization header.")

        token = parts[1]
        try:
            payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
            user_id = payload.get("sub")
            if not user_id or not ObjectId.is_valid(user_id):
                raise exceptions.AuthenticationFailed("Invalid token subject.")
            doc = get_db().users.find_one({"_id": ObjectId(user_id)})
            if not doc:
                raise exceptions.AuthenticationFailed("User not found.")
        except jwt.ExpiredSignatureError as exc:
            raise exceptions.AuthenticationFailed("Token expired.") from exc
        except jwt.InvalidTokenError as exc:
            raise exceptions.AuthenticationFailed("Invalid token.") from exc

        user = MongoUser(id=str(doc["_id"]), email=doc["email"], name=doc.get("name", ""))
        return (user, token)
