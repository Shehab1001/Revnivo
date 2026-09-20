import os
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from pathlib import Path

from bson import ObjectId
from bson.decimal128 import Decimal128
from django.conf import settings


def oid(value):
    if isinstance(value, ObjectId):
        return value
    if not ObjectId.is_valid(str(value)):
        return None
    return ObjectId(str(value))


def utcnow():
    return datetime.now(timezone.utc)


def decimal128(value):
    if isinstance(value, Decimal128):
        return value
    if not isinstance(value, Decimal):
        value = Decimal(str(value))
    return Decimal128(value.quantize(Decimal("0.01")))


def decimal_to_float(value):
    if value is None:
        return 0.0
    if isinstance(value, Decimal128):
        return float(value.to_decimal())
    if isinstance(value, Decimal):
        return float(value)
    return float(value)


def serialize_platform(doc, request=None):
    if not doc:
        return None
    logo = doc.get("logo") or ""
    logo_url = ""
    if logo:
        path = f"{settings.MEDIA_URL}{logo}".replace("//", "/")
        logo_url = request.build_absolute_uri(path) if request else path
    return {
        "id": str(doc["_id"]),
        "name": doc.get("name", ""),
        "website": doc.get("website", ""),
        "default_currency": doc.get("default_currency", "USD"),
        "status": doc.get("status", "not active"),
        "logo_url": logo_url,
        "created_at": doc.get("created_at").isoformat() if doc.get("created_at") else None,
    }


def serialize_earning(doc, platform=None, usd_rate=None):
    if not doc:
        return None
    earned_at = doc.get("earned_at")
    if isinstance(earned_at, datetime):
        earned_at = earned_at.date()
    amount = decimal_to_float(doc.get("amount"))
    currency = doc.get("currency", "USD")
    amount_usd = amount if currency == "USD" else (amount / usd_rate if usd_rate else amount)
    return {
        "id": str(doc["_id"]),
        "platform_id": str(doc.get("platform_id")) if doc.get("platform_id") else None,
        "platform_name": (platform or {}).get("name", "Deleted platform"),
        "amount": amount,
        "currency": currency,
        "amount_usd": round(amount_usd, 2),
        "earned_at": earned_at.isoformat() if isinstance(earned_at, date) else str(earned_at or ""),
        "note": doc.get("note", ""),
        "description": doc.get("note", ""),
        "category": doc.get("category", ""),
        "created_at": doc.get("created_at").isoformat() if doc.get("created_at") else None,
    }


def serialize_note(doc):
    return {
        "id": str(doc["_id"]),
        "title": doc.get("title", ""),
        "content": doc.get("content", ""),
        "created_at": doc.get("created_at").isoformat() if doc.get("created_at") else None,
        "updated_at": doc.get("updated_at").isoformat() if doc.get("updated_at") else None,
    }


def save_logo(uploaded_file, folder="platforms"):
    return save_upload(uploaded_file, folder)


def save_upload(uploaded_file, folder="uploads"):
    ext = Path(uploaded_file.name).suffix.lower() or ".png"
    filename = f"{uuid.uuid4().hex}{ext}"
    rel = Path(folder) / filename
    target = Path(settings.MEDIA_ROOT) / rel
    target.parent.mkdir(parents=True, exist_ok=True)
    with target.open("wb+") as destination:
        for chunk in uploaded_file.chunks():
            destination.write(chunk)
    return str(rel).replace("\\", "/")


def delete_logo(relative_path):
    if not relative_path:
        return
    target = Path(settings.MEDIA_ROOT) / relative_path
    try:
        if target.is_file():
            os.remove(target)
    except OSError:
        pass
