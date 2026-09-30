from datetime import datetime, timezone
from urllib.parse import urlparse

from bson import ObjectId
from pymongo import ASCENDING, DESCENDING
from pymongo.errors import DuplicateKeyError
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .mongo import get_db
from .utils import serialize_datetime, utcnow


APPLICATION_STATUSES = (
    "saved",
    "applied",
    "screening",
    "interview",
    "offer",
    "rejected",
)

APPLICATION_PRIORITIES = ("low", "medium", "high")

STATUS_LABELS = {
    "saved": "Saved",
    "applied": "Applied",
    "screening": "Screening",
    "interview": "Interview",
    "offer": "Offer",
    "rejected": "Rejected",
}

STATUS_COLORS = {
    "saved": "default",
    "applied": "primary",
    "screening": "warning",
    "interview": "secondary",
    "offer": "success",
    "rejected": "danger",
}

APPLICATION_FIELDS = {
    "title",
    "company",
    "source_platform",
    "source_job_id",
    "job_url",
    "location",
    "remote",
    "category",
    "employment_type",
    "salary_text",
    "salary_min",
    "salary_max",
    "currency",
    "status",
    "priority",
    "applied_at",
    "deadline_at",
    "interview_at",
    "recruiter_name",
    "recruiter_email",
    "recruiter_linkedin",
    "notes",
    "tags",
    "archived",
}


def _owner_oid(request):
    return ObjectId(request.user.id)


def _clean_text(value, limit=500):
    if value is None:
        return ""
    return str(value).strip()[:limit]


def _clean_url(value):
    value = _clean_text(value, 2000)
    if not value:
        return ""

    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"}:
        return ""

    return value


def _clean_email(value):
    value = _clean_text(value, 320).lower()
    if not value:
        return ""

    if "@" not in value or value.startswith("@") or value.endswith("@"):
        return ""

    return value


def _clean_float(value):
    if value in (None, ""):
        return None

    try:
        number = float(value)
    except (TypeError, ValueError):
        return None

    if number < 0:
        return None

    return round(number, 2)


def _clean_datetime(value):
    if not value:
        return None

    if isinstance(value, datetime):
        dt = value
    else:
        raw = str(value).strip()
        if not raw:
            return None

        try:
            if len(raw) == 10:
                dt = datetime.fromisoformat(raw + "T00:00:00")
            else:
                dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        except ValueError:
            return None

    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)

    return dt.astimezone(timezone.utc)


def _clean_tags(value):
    if value is None:
        return []

    if isinstance(value, str):
        items = value.split(",")
    elif isinstance(value, (list, tuple, set)):
        items = value
    else:
        items = []

    output = []
    seen = set()

    for item in items:
        tag = _clean_text(item, 40)
        key = tag.lower()

        if not tag or key in seen:
            continue

        seen.add(key)
        output.append(tag)

        if len(output) >= 20:
            break

    return output


def _serialize_event(doc):
    return {
        "id": str(doc["_id"]),
        "application_id": str(doc.get("application_id", "")),
        "kind": doc.get("kind", "update"),
        "title": doc.get("title", ""),
        "message": doc.get("message", ""),
        "from_status": doc.get("from_status", ""),
        "to_status": doc.get("to_status", ""),
        "created_at": serialize_datetime(doc.get("created_at")),
    }


def _serialize_application(doc):
    return {
        "id": str(doc["_id"]),
        "title": doc.get("title", ""),
        "company": doc.get("company", ""),
        "source_platform": doc.get("source_platform", ""),
        "source_job_id": doc.get("source_job_id", ""),
        "job_url": doc.get("job_url", ""),
        "location": doc.get("location", ""),
        "remote": bool(doc.get("remote")),
        "category": doc.get("category", ""),
        "employment_type": doc.get("employment_type", ""),
        "salary_text": doc.get("salary_text", ""),
        "salary_min": doc.get("salary_min"),
        "salary_max": doc.get("salary_max"),
        "currency": doc.get("currency", "USD"),
        "status": doc.get("status", "saved"),
        "priority": doc.get("priority", "medium"),
        "applied_at": serialize_datetime(doc.get("applied_at")),
        "deadline_at": serialize_datetime(doc.get("deadline_at")),
        "interview_at": serialize_datetime(doc.get("interview_at")),
        "recruiter_name": doc.get("recruiter_name", ""),
        "recruiter_email": doc.get("recruiter_email", ""),
        "recruiter_linkedin": doc.get("recruiter_linkedin", ""),
        "notes": doc.get("notes", ""),
        "tags": doc.get("tags", []),
        "archived": bool(doc.get("archived")),
        "created_at": serialize_datetime(doc.get("created_at")),
        "updated_at": serialize_datetime(doc.get("updated_at")),
        "status_changed_at": serialize_datetime(doc.get("status_changed_at")),
    }


def _append_event(
    db,
    owner_id,
    application_id,
    kind,
    title,
    message="",
    from_status="",
    to_status="",
):
    event = {
        "owner_id": owner_id,
        "application_id": application_id,
        "kind": kind,
        "title": title,
        "message": _clean_text(message, 2000),
        "from_status": from_status,
        "to_status": to_status,
        "created_at": utcnow(),
    }
    db.application_events.insert_one(event)


def _ensure_application_indexes(db):
    try:
        db.job_applications.create_index(
            [("owner_id", ASCENDING), ("updated_at", DESCENDING)]
        )
        db.job_applications.create_index(
            [("owner_id", ASCENDING), ("status", ASCENDING)]
        )
        db.job_applications.create_index(
            [("owner_id", ASCENDING), ("job_url", ASCENDING)]
        )
        db.application_events.create_index(
            [
                ("owner_id", ASCENDING),
                ("application_id", ASCENDING),
                ("created_at", DESCENDING),
            ]
        )
    except Exception:
        # Index creation should never block the request path on restricted
        # Mongo deployments.
        pass


def _normalize_application_payload(data, existing=None):
    existing = existing or {}
    output = {}

    if "title" in data:
        output["title"] = _clean_text(data.get("title"), 240)

    if "company" in data:
        output["company"] = _clean_text(data.get("company"), 160)

    if "source_platform" in data:
        output["source_platform"] = _clean_text(
            data.get("source_platform"),
            120,
        )

    if "source_job_id" in data:
        output["source_job_id"] = _clean_text(
            data.get("source_job_id"),
            240,
        )

    if "job_url" in data:
        output["job_url"] = _clean_url(data.get("job_url"))

    if "location" in data:
        output["location"] = _clean_text(data.get("location"), 240)

    if "remote" in data:
        output["remote"] = bool(data.get("remote"))

    if "category" in data:
        output["category"] = _clean_text(data.get("category"), 160)

    if "employment_type" in data:
        output["employment_type"] = _clean_text(
            data.get("employment_type"),
            120,
        )

    if "salary_text" in data:
        output["salary_text"] = _clean_text(data.get("salary_text"), 160)

    if "salary_min" in data:
        output["salary_min"] = _clean_float(data.get("salary_min"))

    if "salary_max" in data:
        output["salary_max"] = _clean_float(data.get("salary_max"))

    if "currency" in data:
        currency = _clean_text(data.get("currency"), 8).upper()
        output["currency"] = currency or "USD"

    if "status" in data:
        status_value = _clean_text(data.get("status"), 40).lower()
        if status_value not in APPLICATION_STATUSES:
            raise ValueError("Invalid application status.")
        output["status"] = status_value

    if "priority" in data:
        priority = _clean_text(data.get("priority"), 40).lower()
        if priority not in APPLICATION_PRIORITIES:
            raise ValueError("Invalid application priority.")
        output["priority"] = priority

    for field in ("applied_at", "deadline_at", "interview_at"):
        if field in data:
            output[field] = _clean_datetime(data.get(field))

    if "recruiter_name" in data:
        output["recruiter_name"] = _clean_text(
            data.get("recruiter_name"),
            160,
        )

    if "recruiter_email" in data:
        output["recruiter_email"] = _clean_email(
            data.get("recruiter_email")
        )

    if "recruiter_linkedin" in data:
        output["recruiter_linkedin"] = _clean_url(
            data.get("recruiter_linkedin")
        )

    if "notes" in data:
        output["notes"] = _clean_text(data.get("notes"), 10000)

    if "tags" in data:
        output["tags"] = _clean_tags(data.get("tags"))

    if "archived" in data:
        output["archived"] = bool(data.get("archived"))

    merged_title = output.get("title", existing.get("title", ""))
    merged_company = output.get("company", existing.get("company", ""))

    if not merged_title:
        raise ValueError("Job title is required.")

    if not merged_company:
        raise ValueError("Company is required.")

    return output


def _find_application(db, owner_id, application_id):
    if not ObjectId.is_valid(str(application_id)):
        return None

    return db.job_applications.find_one(
        {
            "_id": ObjectId(str(application_id)),
            "owner_id": owner_id,
        }
    )


@api_view(["GET", "POST"])
def applications(request):
    db = get_db()
    owner_id = _owner_oid(request)
    _ensure_application_indexes(db)

    if request.method == "POST":
        try:
            payload = _normalize_application_payload(request.data)
        except ValueError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        job_url = payload.get("job_url", "")
        source_job_id = payload.get("source_job_id", "")

        duplicate_query = {"owner_id": owner_id}
        duplicate_clauses = []

        if job_url:
            duplicate_clauses.append({"job_url": job_url})

        if source_job_id:
            duplicate_clauses.append(
                {
                    "source_job_id": source_job_id,
                    "source_platform": payload.get(
                        "source_platform",
                        "",
                    ),
                }
            )

        if duplicate_clauses:
            duplicate_query["$or"] = duplicate_clauses
            existing = db.job_applications.find_one(duplicate_query)

            if existing:
                return Response(
                    {
                        "application": _serialize_application(existing),
                        "duplicate": True,
                    }
                )

        now = utcnow()
        status_value = payload.get("status", "saved")

        doc = {
            "owner_id": owner_id,
            "title": payload.get("title", ""),
            "company": payload.get("company", ""),
            "source_platform": payload.get("source_platform", ""),
            "source_job_id": payload.get("source_job_id", ""),
            "job_url": payload.get("job_url", ""),
            "location": payload.get("location", ""),
            "remote": payload.get("remote", False),
            "category": payload.get("category", ""),
            "employment_type": payload.get("employment_type", ""),
            "salary_text": payload.get("salary_text", ""),
            "salary_min": payload.get("salary_min"),
            "salary_max": payload.get("salary_max"),
            "currency": payload.get("currency", "USD"),
            "status": status_value,
            "priority": payload.get("priority", "medium"),
            "applied_at": payload.get("applied_at"),
            "deadline_at": payload.get("deadline_at"),
            "interview_at": payload.get("interview_at"),
            "recruiter_name": payload.get("recruiter_name", ""),
            "recruiter_email": payload.get("recruiter_email", ""),
            "recruiter_linkedin": payload.get("recruiter_linkedin", ""),
            "notes": payload.get("notes", ""),
            "tags": payload.get("tags", []),
            "archived": payload.get("archived", False),
            "created_at": now,
            "updated_at": now,
            "status_changed_at": now,
        }

        try:
            result = db.job_applications.insert_one(doc)
        except DuplicateKeyError:
            return Response(
                {"detail": "This application is already tracked."},
                status=status.HTTP_409_CONFLICT,
            )

        doc["_id"] = result.inserted_id

        _append_event(
            db,
            owner_id,
            result.inserted_id,
            "created",
            "Application added",
            f"{doc['company']} — {doc['title']}",
            to_status=status_value,
        )

        return Response(
            {
                "application": _serialize_application(doc),
                "duplicate": False,
            },
            status=status.HTTP_201_CREATED,
        )

    query = {"owner_id": owner_id}

    archived_param = str(
        request.query_params.get("archived", "false")
    ).lower()

    if archived_param == "only":
        query["archived"] = True
    elif archived_param not in {"all", "1", "true"}:
        query["archived"] = {"$ne": True}

    requested_status = _clean_text(
        request.query_params.get("status"),
        40,
    ).lower()

    if requested_status in APPLICATION_STATUSES:
        query["status"] = requested_status

    docs = list(
        db.job_applications.find(query).sort("updated_at", DESCENDING)
    )

    return Response(
        {
            "applications": [
                _serialize_application(doc)
                for doc in docs
            ],
            "statuses": [
                {
                    "key": status_key,
                    "label": STATUS_LABELS[status_key],
                    "color": STATUS_COLORS[status_key],
                }
                for status_key in APPLICATION_STATUSES
            ],
            "total": len(docs),
        }
    )


@api_view(["GET", "PATCH", "DELETE"])
def application_detail(request, application_id):
    db = get_db()
    owner_id = _owner_oid(request)
    doc = _find_application(
        db,
        owner_id,
        application_id,
    )

    if not doc:
        return Response(
            {"detail": "Application not found."},
            status=status.HTTP_404_NOT_FOUND,
        )

    if request.method == "GET":
        events = list(
            db.application_events.find(
                {
                    "owner_id": owner_id,
                    "application_id": doc["_id"],
                }
            ).sort("created_at", DESCENDING).limit(100)
        )

        return Response(
            {
                "application": _serialize_application(doc),
                "events": [
                    _serialize_event(event)
                    for event in events
                ],
            }
        )

    if request.method == "DELETE":
        db.application_events.delete_many(
            {
                "owner_id": owner_id,
                "application_id": doc["_id"],
            }
        )
        db.job_applications.delete_one(
            {
                "_id": doc["_id"],
                "owner_id": owner_id,
            }
        )
        return Response(status=status.HTTP_204_NO_CONTENT)

    try:
        updates = _normalize_application_payload(
            request.data,
            existing=doc,
        )
    except ValueError as exc:
        return Response(
            {"detail": str(exc)},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if not updates:
        return Response(
            {"application": _serialize_application(doc)}
        )

    previous_status = doc.get("status", "saved")
    next_status = updates.get("status", previous_status)
    now = utcnow()

    updates["updated_at"] = now

    if next_status != previous_status:
        updates["status_changed_at"] = now

        if (
            next_status == "applied"
            and not updates.get("applied_at")
            and not doc.get("applied_at")
        ):
            updates["applied_at"] = now

    db.job_applications.update_one(
        {
            "_id": doc["_id"],
            "owner_id": owner_id,
        },
        {"$set": updates},
    )

    if next_status != previous_status:
        _append_event(
            db,
            owner_id,
            doc["_id"],
            "status",
            "Stage changed",
            (
                f"{STATUS_LABELS.get(previous_status, previous_status)} "
                f"→ {STATUS_LABELS.get(next_status, next_status)}"
            ),
            from_status=previous_status,
            to_status=next_status,
        )
    else:
        _append_event(
            db,
            owner_id,
            doc["_id"],
            "update",
            "Application updated",
        )

    updated = db.job_applications.find_one(
        {
            "_id": doc["_id"],
            "owner_id": owner_id,
        }
    )

    return Response(
        {"application": _serialize_application(updated)}
    )


@api_view(["PATCH"])
def application_status(request, application_id):
    db = get_db()
    owner_id = _owner_oid(request)
    doc = _find_application(
        db,
        owner_id,
        application_id,
    )

    if not doc:
        return Response(
            {"detail": "Application not found."},
            status=status.HTTP_404_NOT_FOUND,
        )

    next_status = _clean_text(
        request.data.get("status"),
        40,
    ).lower()

    if next_status not in APPLICATION_STATUSES:
        return Response(
            {"detail": "Invalid application status."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    previous_status = doc.get("status", "saved")

    if next_status == previous_status:
        return Response(
            {"application": _serialize_application(doc)}
        )

    now = utcnow()
    updates = {
        "status": next_status,
        "status_changed_at": now,
        "updated_at": now,
    }

    if next_status == "applied" and not doc.get("applied_at"):
        updates["applied_at"] = now

    db.job_applications.update_one(
        {
            "_id": doc["_id"],
            "owner_id": owner_id,
        },
        {"$set": updates},
    )

    _append_event(
        db,
        owner_id,
        doc["_id"],
        "status",
        "Stage changed",
        (
            f"{STATUS_LABELS.get(previous_status, previous_status)} "
            f"→ {STATUS_LABELS.get(next_status, next_status)}"
        ),
        from_status=previous_status,
        to_status=next_status,
    )

    updated = db.job_applications.find_one(
        {
            "_id": doc["_id"],
            "owner_id": owner_id,
        }
    )

    return Response(
        {"application": _serialize_application(updated)}
    )


@api_view(["GET", "POST"])
def application_events(request, application_id):
    db = get_db()
    owner_id = _owner_oid(request)
    application = _find_application(
        db,
        owner_id,
        application_id,
    )

    if not application:
        return Response(
            {"detail": "Application not found."},
            status=status.HTTP_404_NOT_FOUND,
        )

    if request.method == "POST":
        message = _clean_text(
            request.data.get("message"),
            2000,
        )

        if not message:
            return Response(
                {"detail": "Event note is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        event = {
            "owner_id": owner_id,
            "application_id": application["_id"],
            "kind": "note",
            "title": _clean_text(
                request.data.get("title"),
                160,
            ) or "Note added",
            "message": message,
            "from_status": "",
            "to_status": "",
            "created_at": utcnow(),
        }

        result = db.application_events.insert_one(event)
        event["_id"] = result.inserted_id

        return Response(
            {"event": _serialize_event(event)},
            status=status.HTTP_201_CREATED,
        )

    docs = list(
        db.application_events.find(
            {
                "owner_id": owner_id,
                "application_id": application["_id"],
            }
        ).sort("created_at", DESCENDING).limit(200)
    )

    return Response(
        {
            "events": [
                _serialize_event(doc)
                for doc in docs
            ]
        }
    )


@api_view(["GET"])
def application_stats(request):
    db = get_db()
    owner_id = _owner_oid(request)

    docs = list(
        db.job_applications.find(
            {
                "owner_id": owner_id,
                "archived": {"$ne": True},
            }
        )
    )

    by_status = {
        key: 0
        for key in APPLICATION_STATUSES
    }

    by_company = {}
    by_source = {}
    upcoming_interviews = []
    upcoming_deadlines = []

    now = utcnow()

    for doc in docs:
        status_key = doc.get("status", "saved")
        if status_key in by_status:
            by_status[status_key] += 1

        company = doc.get("company", "").strip()
        if company:
            by_company[company] = by_company.get(company, 0) + 1

        source = doc.get("source_platform", "").strip()
        if source:
            by_source[source] = by_source.get(source, 0) + 1

        interview_at = doc.get("interview_at")
        if interview_at and interview_at >= now:
            upcoming_interviews.append(
                {
                    "id": str(doc["_id"]),
                    "company": company,
                    "title": doc.get("title", ""),
                    "at": serialize_datetime(interview_at),
                }
            )

        deadline_at = doc.get("deadline_at")
        if deadline_at and deadline_at >= now:
            upcoming_deadlines.append(
                {
                    "id": str(doc["_id"]),
                    "company": company,
                    "title": doc.get("title", ""),
                    "at": serialize_datetime(deadline_at),
                }
            )

    total = len(docs)
    active = sum(
        by_status[key]
        for key in ("applied", "screening", "interview")
    )
    responses = (
        by_status["screening"]
        + by_status["interview"]
        + by_status["offer"]
        + by_status["rejected"]
    )
    offers = by_status["offer"]

    response_rate = (
        round((responses / max(total - by_status["saved"], 1)) * 100, 1)
        if total
        else 0
    )

    offer_rate = (
        round((offers / max(total - by_status["saved"], 1)) * 100, 1)
        if total
        else 0
    )

    top_companies = sorted(
        (
            {"company": key, "count": value}
            for key, value in by_company.items()
        ),
        key=lambda item: (-item["count"], item["company"].lower()),
    )[:10]

    top_sources = sorted(
        (
            {"source": key, "count": value}
            for key, value in by_source.items()
        ),
        key=lambda item: (-item["count"], item["source"].lower()),
    )[:10]

    upcoming_interviews.sort(key=lambda item: item["at"] or "")
    upcoming_deadlines.sort(key=lambda item: item["at"] or "")

    return Response(
        {
            "total": total,
            "active": active,
            "response_rate": response_rate,
            "offer_rate": offer_rate,
            "by_status": by_status,
            "top_companies": top_companies,
            "top_sources": top_sources,
            "upcoming_interviews": upcoming_interviews[:10],
            "upcoming_deadlines": upcoming_deadlines[:10],
        }
    )
