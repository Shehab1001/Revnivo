import base64
import json
import os
import time
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

import cloudinary
import cloudinary.uploader
import cloudinary.utils


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
    "video/mp4": ".mp4",
    "video/webm": ".webm",
    "text/plain": ".txt",
    "text/csv": ".csv",
}
NOTE_FILE_TYPES = {
    **CHAT_FILE_TYPES,
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
}
MAX_IMAGE_BYTES = 5 * 1024 * 1024
MAX_CHAT_BYTES = 10 * 1024 * 1024
MAX_NOTE_BYTES = 20 * 1024 * 1024


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



CLOUDINARY_REF_PREFIX = "cld:"


def cloudinary_enabled():
    return bool(getattr(settings, "CLOUDINARY_URL", "").strip())


def _configure_cloudinary():
    if cloudinary_enabled():
        # The SDK reads CLOUDINARY_URL from the environment. Request HTTPS URLs
        # for all generated public and signed delivery links.
        cloudinary.config(secure=True)


def _encode_cloudinary_ref(result, fallback_format=""):
    payload = {
        "public_id": str(result.get("public_id") or ""),
        "resource_type": str(result.get("resource_type") or "image"),
        "type": str(result.get("type") or "upload"),
        "format": str(result.get("format") or fallback_format or "").lstrip("."),
        "secure_url": str(result.get("secure_url") or ""),
    }
    raw = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    token = base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")
    return f"{CLOUDINARY_REF_PREFIX}{token}"


def decode_cloudinary_ref(value):
    text = str(value or "")
    if not text.startswith(CLOUDINARY_REF_PREFIX):
        return None

    token = text[len(CLOUDINARY_REF_PREFIX):]
    token += "=" * (-len(token) % 4)
    try:
        payload = json.loads(base64.urlsafe_b64decode(token.encode("ascii")).decode("utf-8"))
    except (ValueError, json.JSONDecodeError, UnicodeDecodeError):
        return None

    if not isinstance(payload, dict) or not payload.get("public_id"):
        return None
    return payload


def is_cloudinary_ref(value):
    return decode_cloudinary_ref(value) is not None


def public_upload_url(storage_ref):
    if not storage_ref:
        return ""

    meta = decode_cloudinary_ref(storage_ref)
    if not meta:
        return f"{settings.MEDIA_URL}{storage_ref}".replace("//", "/")

    if meta.get("type") != "upload":
        return ""

    if meta.get("secure_url"):
        return meta["secure_url"]

    _configure_cloudinary()
    options = {
        "secure": True,
        "resource_type": meta.get("resource_type") or "image",
        "type": "upload",
    }
    if meta.get("format"):
        options["format"] = meta["format"]
    url, _ = cloudinary.utils.cloudinary_url(meta["public_id"], **options)
    return url


def private_upload_download_url(storage_ref):
    meta = decode_cloudinary_ref(storage_ref)
    if not meta:
        return ""

    _configure_cloudinary()
    file_format = str(meta.get("format") or "").lstrip(".")
    if not file_format:
        return ""

    expires_at = int(time.time()) + int(settings.CLOUDINARY_PRIVATE_URL_TTL)
    return cloudinary.utils.private_download_url(
        meta["public_id"],
        file_format,
        resource_type=meta.get("resource_type") or "image",
        type=meta.get("type") or "authenticated",
        expires_at=expires_at,
    )


def _cloudinary_upload_bytes(data, folder, extension):
    safe_folder = str(folder).strip().replace("\\", "/").strip("/")
    if not safe_folder or ".." in safe_folder.split("/"):
        raise ValidationError("Invalid upload destination.")

    _configure_cloudinary()
    stream = BytesIO(data)
    stream.name = f"upload{extension or ''}"

    delivery_type = "authenticated" if safe_folder in {"chat", "notes"} else "upload"
    public_id = f"{settings.CLOUDINARY_FOLDER}/{safe_folder}/{uuid.uuid4().hex}"

    try:
        result = cloudinary.uploader.upload(
            stream,
            resource_type="auto",
            type=delivery_type,
            public_id=public_id,
            asset_folder=f"{settings.CLOUDINARY_FOLDER}/{safe_folder}",
            unique_filename=False,
            overwrite=False,
        )
    except Exception as exc:
        raise ValidationError("Could not store the uploaded file.") from exc

    return _encode_cloudinary_ref(result, str(extension or "").lstrip("."))

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
    logo_url = public_upload_url(logo) if logo else ""
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
    expected_at = doc.get("expected_at")
    if isinstance(earned_at, datetime):
        earned_at = earned_at.date()
    if isinstance(expected_at, datetime):
        expected_at = expected_at.date()

    amount = decimal_to_float(doc.get("amount"))
    platform_fee = decimal_to_float(doc.get("platform_fee"))
    payment_fee = decimal_to_float(doc.get("payment_fee"))
    net_amount = max(amount - platform_fee - payment_fee, 0)
    currency = doc.get("currency", "USD")
    status_value = doc.get("status", "paid")

    if status_value == "pending" and expected_at:
        expected_date = expected_at if isinstance(expected_at, date) else None
        if expected_date and expected_date < date.today():
            status_value = "overdue"

    if isinstance(usd_rate, dict):
        source_rate = usd_rate.get(currency)
        amount_usd = amount / float(source_rate) if source_rate else amount
        net_amount_usd = net_amount / float(source_rate) if source_rate else net_amount
    else:
        amount_usd = amount if currency == "USD" else (amount / usd_rate if usd_rate else amount)
        net_amount_usd = net_amount if currency == "USD" else (net_amount / usd_rate if usd_rate else net_amount)

    return {
        "id": str(doc["_id"]),
        "platform_id": str(doc.get("platform_id")) if doc.get("platform_id") else None,
        "platform_name": (platform or {}).get("name", "Deleted platform"),
        "amount": amount,
        "gross_amount": amount,
        "platform_fee": platform_fee,
        "payment_fee": payment_fee,
        "net_amount": round(net_amount, 2),
        "currency": currency,
        "amount_usd": round(amount_usd, 2),
        "net_amount_usd": round(net_amount_usd, 2),
        "status": status_value,
        "earned_at": earned_at.isoformat() if isinstance(earned_at, date) else str(earned_at or ""),
        "expected_at": expected_at.isoformat() if isinstance(expected_at, date) else str(expected_at or ""),
        "note": doc.get("note", ""),
        "description": doc.get("note", ""),
        "category": doc.get("category", ""),
        "created_at": serialize_datetime(doc.get("created_at")),
    }

def serialize_note(doc):
    note_id = str(doc["_id"])
    attachments = []
    for attachment in doc.get("attachments", []) or []:
        attachment_id = str(attachment.get("id") or "")
        attachments.append({
            "id": attachment_id,
            "name": attachment.get("name", "Attachment"),
            "mime": attachment.get("mime", "application/octet-stream"),
            "size": int(attachment.get("size", 0) or 0),
            "kind": attachment.get("kind", "file"),
            "url": f"/api/notes/{note_id}/attachments/{attachment_id}/",
            "created_at": serialize_datetime(attachment.get("created_at")),
        })

    return {
        "id": note_id,
        "title": doc.get("title", ""),
        # content stays as a plain-text compatibility/search field for notes
        # created before the workspace editor was introduced.
        "content": doc.get("content", ""),
        "content_html": doc.get("content_html", ""),
        "attachments": attachments,
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


def _upload_root(folder):
    return Path(
        settings.PRIVATE_MEDIA_ROOT
        if str(folder).strip().strip("/") in {"chat", "notes"}
        else settings.MEDIA_ROOT
    ).resolve()


def _save_bytes(data, folder, extension):
    safe_folder = str(folder).strip().replace("\\", "/").strip("/")
    if not safe_folder or ".." in safe_folder.split("/"):
        raise ValidationError("Invalid upload destination.")

    if cloudinary_enabled():
        return _cloudinary_upload_bytes(data, safe_folder, extension)

    rel = Path(safe_folder) / f"{uuid.uuid4().hex}{extension}"
    upload_root = _upload_root(safe_folder)
    target = (upload_root / rel).resolve()

    if upload_root not in target.parents:
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

    if mime in {"audio/mp4", "video/mp4"}:
        return len(data) >= 12 and b"ftyp" in data[4:12]

    if mime == "video/webm":
        return data.startswith(b"\x1a\x45\xdf\xa3")

    if mime in {"text/plain", "text/csv"}:
        if b"\x00" in data:
            return False
        try:
            data.decode("utf-8")
            return True
        except UnicodeDecodeError:
            return False

    return False


def _validate_note_file(data, mime):
    if mime in CHAT_FILE_TYPES:
        return _validate_chat_file(data, mime)

    if mime in {
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    }:
        return data.startswith(b"PK\x03\x04")

    return False


def save_logo(uploaded_file, folder="platforms"):
    return _save_image(uploaded_file, folder)


def save_upload(uploaded_file, folder="uploads"):
    if folder in {"profiles", "platforms"}:
        return _save_image(uploaded_file, folder)

    is_note = str(folder).strip().strip("/") == "notes"
    max_bytes = MAX_NOTE_BYTES if is_note else MAX_CHAT_BYTES
    data = _read_upload(uploaded_file, max_bytes)
    mime = str(getattr(uploaded_file, "content_type", "") or "").split(";", 1)[0].lower()

    if mime in IMAGE_MIME_TYPES:
        return _save_image(uploaded_file, folder)

    file_types = NOTE_FILE_TYPES if is_note else CHAT_FILE_TYPES
    validator = _validate_note_file if is_note else _validate_chat_file
    extension = file_types.get(mime)

    if not extension or not validator(data, mime):
        if is_note:
            raise ValidationError(
                "Unsupported note attachment. Allowed: images, PDF, Word, Excel, PowerPoint, MP4/WebM video, audio, TXT, and CSV."
            )
        raise ValidationError(
            "Unsupported file. Allowed: JPEG, PNG, WebP, MP4/WebM video, PDF, WebM/OGG/MP3/M4A audio, TXT, and CSV."
        )

    return _save_bytes(data, folder, extension)


def resolve_upload_path(relative_path):
    if not relative_path:
        return None

    relative = str(relative_path).replace("\\", "/").lstrip("/")
    roots = []

    if relative.startswith(("chat/", "notes/")):
        roots.append(Path(settings.PRIVATE_MEDIA_ROOT).resolve())
        # Legacy fallback for chat files created before private-media hardening.
        roots.append(Path(settings.MEDIA_ROOT).resolve())
    else:
        roots.append(Path(settings.MEDIA_ROOT).resolve())

    for root in roots:
        target = (root / relative).resolve()
        if root in target.parents and target.is_file():
            return target

    return None


def migrate_local_upload(relative_path):
    if not relative_path or is_cloudinary_ref(relative_path):
        return relative_path

    target = resolve_upload_path(relative_path)
    if not target:
        raise FileNotFoundError(str(relative_path))

    relative = str(relative_path).replace("\\", "/").lstrip("/")
    folder = relative.split("/", 1)[0] if "/" in relative else "uploads"
    return _cloudinary_upload_bytes(target.read_bytes(), folder, target.suffix)


def delete_logo(relative_path):
    meta = decode_cloudinary_ref(relative_path)
    if meta:
        _configure_cloudinary()
        try:
            cloudinary.uploader.destroy(
                meta["public_id"],
                resource_type=meta.get("resource_type") or "image",
                type=meta.get("type") or "upload",
                invalidate=meta.get("type") == "upload",
            )
        except Exception:
            # Deleting an old asset should never prevent the database record
            # from being updated or the user from replacing a file.
            pass
        return

    target = resolve_upload_path(relative_path)
    if not target:
        return

    try:
        os.remove(target)
    except OSError:
        pass
