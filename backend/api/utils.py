import os
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from io import BytesIO
from pathlib import Path

from bson import ObjectId
from bson.decimal128 import Decimal128
from django.conf import settings
from PIL import Image, UnidentifiedImageError
from rest_framework.exceptions import ValidationError


IMAGE_MIME_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
}
CHAT_FILE_TYPES = {
    "application/pdf": ".pdf",
    "audio/webm": ".webm",
    "audio/ogg": ".ogg",
    "audio/mpeg": ".mp3",
    "audio/mp4": ".m4a",
    "text/plain": ".txt",
    "text/csv": ".csv",
}
MAX_IMAGE_BYTES = 5 * 1024 * 1024
MAX_CHAT_BYTES = 10 * 1024 * 1024


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


def serialize_datetime(value):
    if not value:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.isoformat().replace("+00:00", "Z")


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
        "created_at": serialize_datetime(doc.get("created_at")),
    }


def serialize_earning(doc, platform=None, usd_rate=None):
    if not doc:
        return None
    earned_at = doc.get("earned_at")
    if isinstance(earned_at, datetime):
        earned_at = earned_at.date()
    amount = decimal_to_float(doc.get("amount"))
    currency = doc.get("currency", "USD")
    if isinstance(usd_rate, dict):
        source_rate = usd_rate.get(currency)
        amount_usd = amount / float(source_rate) if source_rate else amount
    else:
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
        "created_at": serialize_datetime(doc.get("created_at")),
    }


def serialize_note(doc):
    return {
        "id": str(doc["_id"]),
        "title": doc.get("title", ""),
        "content": doc.get("content", ""),
        "created_at": serialize_datetime(doc.get("created_at")),
        "updated_at": serialize_datetime(doc.get("updated_at")),
    }


def _read_upload(uploaded_file, max_bytes):
    size = getattr(uploaded_file, "size", 0) or 0
    if size <= 0:
        raise ValidationError("The uploaded file is empty.")
    if size > max_bytes:
        raise ValidationError(
            f"File is too large. Maximum size is {max_bytes // (1024 * 1024)} MB."
        )

    uploaded_file.seek(0)
    data = uploaded_file.read(max_bytes + 1)
    uploaded_file.seek(0)

    if len(data) > max_bytes:
        raise ValidationError("The uploaded file exceeds the allowed size.")

    return data


def _save_bytes(data, folder, extension):
    safe_folder = str(folder).strip().replace("\\", "/").strip("/")
    if not safe_folder or ".." in safe_folder.split("/"):
        raise ValidationError("Invalid upload destination.")

    rel = Path(safe_folder) / f"{uuid.uuid4().hex}{extension}"
    media_root = Path(settings.MEDIA_ROOT).resolve()
    target = (media_root / rel).resolve()

    if media_root not in target.parents:
        raise ValidationError("Invalid upload destination.")

    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
    return str(rel).replace("\\", "/")


def _save_image(uploaded_file, folder):
    data = _read_upload(uploaded_file, MAX_IMAGE_BYTES)
    mime = str(getattr(uploaded_file, "content_type", "") or "").split(";", 1)[0].lower()

    if mime not in IMAGE_MIME_TYPES:
        raise ValidationError("Only JPEG, PNG, and WebP images are allowed.")

    try:
        probe = Image.open(BytesIO(data))
        probe.verify()

        image = Image.open(BytesIO(data))
        if image.width > 8000 or image.height > 8000:
            raise ValidationError("Image dimensions are too large.")

        # Re-encoding strips active metadata/polyglot payloads and gives every
        # user image a controlled server-generated extension.
        if image.mode not in ("RGB", "RGBA"):
            image = image.convert("RGBA" if "transparency" in image.info else "RGB")

        output = BytesIO()
        image.save(output, format="WEBP", quality=90, method=4)
        return _save_bytes(output.getvalue(), folder, ".webp")
    except (UnidentifiedImageError, OSError, ValueError):
        raise ValidationError("The uploaded image is invalid.")


def _validate_chat_file(data, mime):
    if mime == "application/pdf":
        return data.startswith(b"%PDF-")

    if mime == "audio/webm":
        return data.startswith(b"\x1a\x45\xdf\xa3")

    if mime == "audio/ogg":
        return data.startswith(b"OggS")

    if mime == "audio/mpeg":
        return data.startswith(b"ID3") or (
            len(data) >= 2 and data[0] == 0xFF and (data[1] & 0xE0) == 0xE0
        )

    if mime == "audio/mp4":
        return len(data) >= 12 and b"ftyp" in data[4:12]

    if mime in {"text/plain", "text/csv"}:
        if b"\x00" in data:
            return False
        try:
            data.decode("utf-8")
            return True
        except UnicodeDecodeError:
            return False

    return False


def save_logo(uploaded_file, folder="platforms"):
    return _save_image(uploaded_file, folder)


def save_upload(uploaded_file, folder="uploads"):
    if folder in {"profiles", "platforms"}:
        return _save_image(uploaded_file, folder)

    data = _read_upload(uploaded_file, MAX_CHAT_BYTES)
    mime = str(getattr(uploaded_file, "content_type", "") or "").split(";", 1)[0].lower()

    if mime in IMAGE_MIME_TYPES:
        return _save_image(uploaded_file, folder)

    extension = CHAT_FILE_TYPES.get(mime)
    if not extension or not _validate_chat_file(data, mime):
        raise ValidationError(
            "Unsupported file. Allowed: JPEG, PNG, WebP, PDF, WebM/OGG/MP3/M4A audio, TXT, and CSV."
        )

    return _save_bytes(data, folder, extension)


def delete_logo(relative_path):
    if not relative_path:
        return

    media_root = Path(settings.MEDIA_ROOT).resolve()
    target = (media_root / str(relative_path)).resolve()

    if media_root not in target.parents:
        return

    try:
        if target.is_file():
            os.remove(target)
    except OSError:
        pass
