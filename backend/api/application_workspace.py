import secrets
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone

from bson import ObjectId
from django.http import FileResponse, HttpResponseRedirect
from pymongo import ASCENDING, DESCENDING
from rest_framework import status
from rest_framework.decorators import api_view, parser_classes
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from .mongo import get_db
from .utils import (
    delete_logo,
    private_upload_download_url,
    resolve_upload_path,
    save_upload,
    serialize_datetime,
    utcnow,
)


TASK_PRIORITIES = {"low", "medium", "high", "urgent"}
INTERVIEW_RESULTS = {
    "pending",
    "passed",
    "failed",
    "cancelled",
    "rescheduled",
}
DOCUMENT_KINDS = {
    "resume",
    "cover_letter",
    "portfolio",
    "assessment",
    "offer",
    "other",
}


def _owner_oid(request):
    return ObjectId(request.user.id)


def _object_id(value):
    if isinstance(value, ObjectId):
        return value

    if not ObjectId.is_valid(str(value)):
        return None

    return ObjectId(str(value))


def _text(value, limit=1000):
    if value is None:
        return ""

    return str(value).strip()[:limit]


def _boolean(value):
    if isinstance(value, bool):
        return value

    if value is None:
        return False

    return str(value).strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }


def _number(value, default=0, minimum=None, maximum=None):
    try:
        number = int(value)
    except (TypeError, ValueError):
        number = default

    if minimum is not None:
        number = max(number, minimum)

    if maximum is not None:
        number = min(number, maximum)

    return number


def _datetime(value):
    if not value:
        return None

    if isinstance(value, datetime):
        output = value
    else:
        raw = str(value).strip()
        if not raw:
            return None

        try:
            if len(raw) == 10:
                output = datetime.fromisoformat(
                    raw + "T00:00:00"
                )
            else:
                output = datetime.fromisoformat(
                    raw.replace("Z", "+00:00")
                )
        except ValueError:
            return None

    if output.tzinfo is None:
        output = output.replace(tzinfo=timezone.utc)

    return output.astimezone(timezone.utc)


def _application(db, owner_id, application_id):
    application_oid = _object_id(application_id)

    if not application_oid:
        return None

    return db.job_applications.find_one(
        {
            "_id": application_oid,
            "owner_id": owner_id,
        }
    )


def _ensure_indexes(db):
    try:
        db.application_tasks.create_index(
            [
                ("owner_id", ASCENDING),
                ("application_id", ASCENDING),
                ("due_at", ASCENDING),
            ]
        )
        db.application_tasks.create_index(
            [
                ("owner_id", ASCENDING),
                ("completed", ASCENDING),
                ("reminder_at", ASCENDING),
            ]
        )
        db.application_interviews.create_index(
            [
                ("owner_id", ASCENDING),
                ("application_id", ASCENDING),
                ("scheduled_at", ASCENDING),
            ]
        )
        db.application_documents.create_index(
            [
                ("owner_id", ASCENDING),
                ("application_id", ASCENDING),
                ("created_at", DESCENDING),
            ]
        )
    except Exception:
        pass


def _serialize_task(doc):
    return {
        "id": str(doc["_id"]),
        "application_id": str(
            doc.get("application_id", "")
        ),
        "title": doc.get("title", ""),
        "description": doc.get("description", ""),
        "priority": doc.get("priority", "medium"),
        "due_at": serialize_datetime(doc.get("due_at")),
        "reminder_at": serialize_datetime(
            doc.get("reminder_at")
        ),
        "completed": bool(doc.get("completed")),
        "completed_at": serialize_datetime(
            doc.get("completed_at")
        ),
        "created_at": serialize_datetime(
            doc.get("created_at")
        ),
        "updated_at": serialize_datetime(
            doc.get("updated_at")
        ),
    }


def _serialize_interview(doc):
    return {
        "id": str(doc["_id"]),
        "application_id": str(
            doc.get("application_id", "")
        ),
        "title": doc.get("title", ""),
        "round_type": doc.get(
            "round_type",
            "Interview",
        ),
        "scheduled_at": serialize_datetime(
            doc.get("scheduled_at")
        ),
        "duration_minutes": int(
            doc.get("duration_minutes", 60) or 60
        ),
        "timezone": doc.get("timezone", ""),
        "meeting_url": doc.get("meeting_url", ""),
        "location": doc.get("location", ""),
        "interviewer_name": doc.get(
            "interviewer_name",
            "",
        ),
        "interviewer_email": doc.get(
            "interviewer_email",
            "",
        ),
        "notes": doc.get("notes", ""),
        "prep_notes": doc.get("prep_notes", ""),
        "questions": doc.get("questions", []),
        "result": doc.get("result", "pending"),
        "completed": bool(doc.get("completed")),
        "created_at": serialize_datetime(
            doc.get("created_at")
        ),
        "updated_at": serialize_datetime(
            doc.get("updated_at")
        ),
    }


def _serialize_document(doc):
    return {
        "id": str(doc["_id"]),
        "application_id": str(
            doc.get("application_id", "")
        ),
        "name": doc.get("name", "Document"),
        "mime": doc.get(
            "mime",
            "application/octet-stream",
        ),
        "size": int(doc.get("size", 0) or 0),
        "kind": doc.get("kind", "other"),
        "note": doc.get("note", ""),
        "created_at": serialize_datetime(
            doc.get("created_at")
        ),
        "download_url": (
            f"/api/applications/"
            f"{doc.get('application_id')}/documents/"
            f"{doc.get('_id')}/"
        ),
    }


def _task_payload(data, existing=None):
    existing = existing or {}
    updates = {}

    if "title" in data:
        updates["title"] = _text(
            data.get("title"),
            240,
        )

    if "description" in data:
        updates["description"] = _text(
            data.get("description"),
            4000,
        )

    if "priority" in data:
        priority = _text(
            data.get("priority"),
            40,
        ).lower()

        if priority not in TASK_PRIORITIES:
            raise ValueError("Invalid task priority.")

        updates["priority"] = priority

    if "due_at" in data:
        updates["due_at"] = _datetime(
            data.get("due_at")
        )

    if "reminder_at" in data:
        updates["reminder_at"] = _datetime(
            data.get("reminder_at")
        )

    if "completed" in data:
        completed = _boolean(data.get("completed"))
        updates["completed"] = completed
        updates["completed_at"] = (
            utcnow()
            if completed
            else None
        )

    title = updates.get(
        "title",
        existing.get("title", ""),
    )

    if not title:
        raise ValueError("Task title is required.")

    return updates


def _interview_payload(data, existing=None):
    existing = existing or {}
    updates = {}

    text_fields = {
        "title": 240,
        "round_type": 120,
        "timezone": 100,
        "meeting_url": 2000,
        "location": 240,
        "interviewer_name": 160,
        "interviewer_email": 320,
        "notes": 5000,
        "prep_notes": 10000,
    }

    for field, limit in text_fields.items():
        if field in data:
            updates[field] = _text(
                data.get(field),
                limit,
            )

    if "scheduled_at" in data:
        updates["scheduled_at"] = _datetime(
            data.get("scheduled_at")
        )

    if "duration_minutes" in data:
        updates["duration_minutes"] = _number(
            data.get("duration_minutes"),
            default=60,
            minimum=5,
            maximum=480,
        )

    if "result" in data:
        result = _text(
            data.get("result"),
            40,
        ).lower()

        if result not in INTERVIEW_RESULTS:
            raise ValueError(
                "Invalid interview result."
            )

        updates["result"] = result
        updates["completed"] = (
            result
            not in {
                "pending",
                "rescheduled",
            }
        )

    if "completed" in data:
        updates["completed"] = _boolean(
            data.get("completed")
        )

    if "questions" in data:
        raw_questions = data.get("questions")

        if isinstance(raw_questions, str):
            raw_questions = [
                line.strip()
                for line in raw_questions.splitlines()
                if line.strip()
            ]

        if not isinstance(raw_questions, list):
            raw_questions = []

        questions = []

        for item in raw_questions:
            question = _text(item, 500)
            if question:
                questions.append(question)

            if len(questions) >= 50:
                break

        updates["questions"] = questions

    title = updates.get(
        "title",
        existing.get("title", ""),
    )

    if not title:
        updates["title"] = "Interview"

    scheduled = updates.get(
        "scheduled_at",
        existing.get("scheduled_at"),
    )

    if not scheduled:
        raise ValueError(
            "Interview date and time are required."
        )

    return updates


def _record_event(
    db,
    owner_id,
    application_id,
    kind,
    title,
    message="",
):
    db.application_events.insert_one(
        {
            "owner_id": owner_id,
            "application_id": application_id,
            "kind": kind,
            "title": title,
            "message": _text(message, 2000),
            "from_status": "",
            "to_status": "",
            "created_at": utcnow(),
        }
    )


@api_view(["GET", "POST"])
def application_tasks(request, application_id):
    db = get_db()
    owner_id = _owner_oid(request)
    application = _application(
        db,
        owner_id,
        application_id,
    )

    if not application:
        return Response(
            {"detail": "Application not found."},
            status=status.HTTP_404_NOT_FOUND,
        )

    _ensure_indexes(db)

    if request.method == "POST":
        try:
            payload = _task_payload(request.data)
        except ValueError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        now = utcnow()
        doc = {
            "owner_id": owner_id,
            "application_id": application["_id"],
            "title": payload.get("title", ""),
            "description": payload.get(
                "description",
                "",
            ),
            "priority": payload.get(
                "priority",
                "medium",
            ),
            "due_at": payload.get("due_at"),
            "reminder_at": payload.get(
                "reminder_at"
            ),
            "completed": payload.get(
                "completed",
                False,
            ),
            "completed_at": payload.get(
                "completed_at"
            ),
            "created_at": now,
            "updated_at": now,
        }

        result = db.application_tasks.insert_one(
            doc
        )
        doc["_id"] = result.inserted_id

        _record_event(
            db,
            owner_id,
            application["_id"],
            "task",
            "Task created",
            doc["title"],
        )

        return Response(
            {"task": _serialize_task(doc)},
            status=status.HTTP_201_CREATED,
        )

    include_completed = _boolean(
        request.query_params.get(
            "include_completed",
            True,
        )
    )

    query = {
        "owner_id": owner_id,
        "application_id": application["_id"],
    }

    if not include_completed:
        query["completed"] = {"$ne": True}

    docs = list(
        db.application_tasks.find(query).sort(
            [
                ("completed", ASCENDING),
                ("due_at", ASCENDING),
                ("created_at", DESCENDING),
            ]
        )
    )

    return Response(
        {
            "tasks": [
                _serialize_task(doc)
                for doc in docs
            ],
            "total": len(docs),
        }
    )


@api_view(["PATCH", "DELETE"])
def application_task_detail(
    request,
    application_id,
    task_id,
):
    db = get_db()
    owner_id = _owner_oid(request)
    application = _application(
        db,
        owner_id,
        application_id,
    )
    task_oid = _object_id(task_id)

    if not application or not task_oid:
        return Response(
            {"detail": "Task not found."},
            status=status.HTTP_404_NOT_FOUND,
        )

    task = db.application_tasks.find_one(
        {
            "_id": task_oid,
            "owner_id": owner_id,
            "application_id": application["_id"],
        }
    )

    if not task:
        return Response(
            {"detail": "Task not found."},
            status=status.HTTP_404_NOT_FOUND,
        )

    if request.method == "DELETE":
        db.application_tasks.delete_one(
            {
                "_id": task["_id"],
                "owner_id": owner_id,
            }
        )

        _record_event(
            db,
            owner_id,
            application["_id"],
            "task",
            "Task deleted",
            task.get("title", ""),
        )

        return Response(
            status=status.HTTP_204_NO_CONTENT
        )

    try:
        updates = _task_payload(
            request.data,
            existing=task,
        )
    except ValueError as exc:
        return Response(
            {"detail": str(exc)},
            status=status.HTTP_400_BAD_REQUEST,
        )

    updates["updated_at"] = utcnow()

    db.application_tasks.update_one(
        {
            "_id": task["_id"],
            "owner_id": owner_id,
        },
        {"$set": updates},
    )

    updated = db.application_tasks.find_one(
        {
            "_id": task["_id"],
            "owner_id": owner_id,
        }
    )

    if (
        "completed" in updates
        and updates["completed"]
        != bool(task.get("completed"))
    ):
        _record_event(
            db,
            owner_id,
            application["_id"],
            "task",
            (
                "Task completed"
                if updates["completed"]
                else "Task reopened"
            ),
            task.get("title", ""),
        )

    return Response(
        {"task": _serialize_task(updated)}
    )


@api_view(["GET", "POST"])
def application_interviews(
    request,
    application_id,
):
    db = get_db()
    owner_id = _owner_oid(request)
    application = _application(
        db,
        owner_id,
        application_id,
    )

    if not application:
        return Response(
            {"detail": "Application not found."},
            status=status.HTTP_404_NOT_FOUND,
        )

    _ensure_indexes(db)

    if request.method == "POST":
        try:
            payload = _interview_payload(
                request.data
            )
        except ValueError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        now = utcnow()
        doc = {
            "owner_id": owner_id,
            "application_id": application["_id"],
            "title": payload.get(
                "title",
                "Interview",
            ),
            "round_type": payload.get(
                "round_type",
                "Interview",
            ),
            "scheduled_at": payload.get(
                "scheduled_at"
            ),
            "duration_minutes": payload.get(
                "duration_minutes",
                60,
            ),
            "timezone": payload.get(
                "timezone",
                "",
            ),
            "meeting_url": payload.get(
                "meeting_url",
                "",
            ),
            "location": payload.get(
                "location",
                "",
            ),
            "interviewer_name": payload.get(
                "interviewer_name",
                "",
            ),
            "interviewer_email": payload.get(
                "interviewer_email",
                "",
            ),
            "notes": payload.get(
                "notes",
                "",
            ),
            "prep_notes": payload.get(
                "prep_notes",
                "",
            ),
            "questions": payload.get(
                "questions",
                [],
            ),
            "result": payload.get(
                "result",
                "pending",
            ),
            "completed": payload.get(
                "completed",
                False,
            ),
            "created_at": now,
            "updated_at": now,
        }

        result = (
            db.application_interviews.insert_one(
                doc
            )
        )
        doc["_id"] = result.inserted_id

        db.job_applications.update_one(
            {
                "_id": application["_id"],
                "owner_id": owner_id,
            },
            {
                "$set": {
                    "interview_at": doc[
                        "scheduled_at"
                    ],
                    "updated_at": now,
                }
            },
        )

        _record_event(
            db,
            owner_id,
            application["_id"],
            "interview",
            "Interview scheduled",
            (
                f"{doc['title']} — "
                f"{serialize_datetime(doc['scheduled_at'])}"
            ),
        )

        return Response(
            {
                "interview": _serialize_interview(
                    doc
                )
            },
            status=status.HTTP_201_CREATED,
        )

    docs = list(
        db.application_interviews.find(
            {
                "owner_id": owner_id,
                "application_id": application["_id"],
            }
        ).sort("scheduled_at", ASCENDING)
    )

    return Response(
        {
            "interviews": [
                _serialize_interview(doc)
                for doc in docs
            ],
            "total": len(docs),
        }
    )


@api_view(["PATCH", "DELETE"])
def application_interview_detail(
    request,
    application_id,
    interview_id,
):
    db = get_db()
    owner_id = _owner_oid(request)
    application = _application(
        db,
        owner_id,
        application_id,
    )
    interview_oid = _object_id(interview_id)

    if not application or not interview_oid:
        return Response(
            {"detail": "Interview not found."},
            status=status.HTTP_404_NOT_FOUND,
        )

    interview = (
        db.application_interviews.find_one(
            {
                "_id": interview_oid,
                "owner_id": owner_id,
                "application_id": application[
                    "_id"
                ],
            }
        )
    )

    if not interview:
        return Response(
            {"detail": "Interview not found."},
            status=status.HTTP_404_NOT_FOUND,
        )

    if request.method == "DELETE":
        db.application_interviews.delete_one(
            {
                "_id": interview["_id"],
                "owner_id": owner_id,
            }
        )

        _record_event(
            db,
            owner_id,
            application["_id"],
            "interview",
            "Interview deleted",
            interview.get("title", ""),
        )

        return Response(
            status=status.HTTP_204_NO_CONTENT
        )

    try:
        updates = _interview_payload(
            request.data,
            existing=interview,
        )
    except ValueError as exc:
        return Response(
            {"detail": str(exc)},
            status=status.HTTP_400_BAD_REQUEST,
        )

    updates["updated_at"] = utcnow()

    db.application_interviews.update_one(
        {
            "_id": interview["_id"],
            "owner_id": owner_id,
        },
        {"$set": updates},
    )

    updated = (
        db.application_interviews.find_one(
            {
                "_id": interview["_id"],
                "owner_id": owner_id,
            }
        )
    )

    if "scheduled_at" in updates:
        db.job_applications.update_one(
            {
                "_id": application["_id"],
                "owner_id": owner_id,
            },
            {
                "$set": {
                    "interview_at": updates[
                        "scheduled_at"
                    ],
                    "updated_at": utcnow(),
                }
            },
        )

    _record_event(
        db,
        owner_id,
        application["_id"],
        "interview",
        "Interview updated",
        updated.get("title", ""),
    )

    return Response(
        {
            "interview": _serialize_interview(
                updated
            )
        }
    )


@api_view(["GET", "POST"])
@parser_classes(
    [
        MultiPartParser,
        FormParser,
        JSONParser,
    ]
)
def application_documents(
    request,
    application_id,
):
    db = get_db()
    owner_id = _owner_oid(request)
    application = _application(
        db,
        owner_id,
        application_id,
    )

    if not application:
        return Response(
            {"detail": "Application not found."},
            status=status.HTTP_404_NOT_FOUND,
        )

    _ensure_indexes(db)

    if request.method == "POST":
        uploaded = request.FILES.get("file")

        if not uploaded:
            return Response(
                {
                    "detail": (
                        "Choose a document to upload."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        existing_count = (
            db.application_documents.count_documents(
                {
                    "owner_id": owner_id,
                    "application_id": application[
                        "_id"
                    ],
                }
            )
        )

        if existing_count >= 30:
            return Response(
                {
                    "detail": (
                        "An application can contain "
                        "up to 30 documents."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        document_kind = _text(
            request.data.get("kind"),
            40,
        ).lower()

        if document_kind not in DOCUMENT_KINDS:
            document_kind = "other"

        try:
            path = save_upload(
                uploaded,
                "applications",
            )
        except Exception as exc:
            return Response(
                {
                    "detail": (
                        getattr(
                            exc,
                            "detail",
                            None,
                        )
                        or str(exc)
                        or "Could not upload document."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        now = utcnow()
        doc = {
            "owner_id": owner_id,
            "application_id": application["_id"],
            "path": path,
            "name": _text(
                getattr(
                    uploaded,
                    "name",
                    "Document",
                ),
                180,
            ),
            "mime": _text(
                getattr(
                    uploaded,
                    "content_type",
                    "",
                ),
                180,
            ),
            "size": int(
                getattr(
                    uploaded,
                    "size",
                    0,
                )
                or 0
            ),
            "kind": document_kind,
            "note": _text(
                request.data.get("note"),
                1000,
            ),
            "created_at": now,
        }

        result = (
            db.application_documents.insert_one(
                doc
            )
        )
        doc["_id"] = result.inserted_id

        _record_event(
            db,
            owner_id,
            application["_id"],
            "document",
            "Document uploaded",
            doc["name"],
        )

        return Response(
            {
                "document": _serialize_document(
                    doc
                )
            },
            status=status.HTTP_201_CREATED,
        )

    docs = list(
        db.application_documents.find(
            {
                "owner_id": owner_id,
                "application_id": application["_id"],
            }
        ).sort("created_at", DESCENDING)
    )

    return Response(
        {
            "documents": [
                _serialize_document(doc)
                for doc in docs
            ],
            "total": len(docs),
        }
    )


@api_view(["GET", "DELETE"])
def application_document_detail(
    request,
    application_id,
    document_id,
):
    db = get_db()
    owner_id = _owner_oid(request)
    application = _application(
        db,
        owner_id,
        application_id,
    )
    document_oid = _object_id(document_id)

    if not application or not document_oid:
        return Response(
            {"detail": "Document not found."},
            status=status.HTTP_404_NOT_FOUND,
        )

    document = (
        db.application_documents.find_one(
            {
                "_id": document_oid,
                "owner_id": owner_id,
                "application_id": application[
                    "_id"
                ],
            }
        )
    )

    if not document:
        return Response(
            {"detail": "Document not found."},
            status=status.HTTP_404_NOT_FOUND,
        )

    if request.method == "DELETE":
        delete_logo(document.get("path"))

        db.application_documents.delete_one(
            {
                "_id": document["_id"],
                "owner_id": owner_id,
            }
        )

        _record_event(
            db,
            owner_id,
            application["_id"],
            "document",
            "Document removed",
            document.get("name", ""),
        )

        return Response(
            status=status.HTTP_204_NO_CONTENT
        )

    cloud_url = private_upload_download_url(
        document.get("path")
    )

    if cloud_url:
        response = HttpResponseRedirect(
            cloud_url
        )
        response["Cache-Control"] = (
            "private, no-store"
        )
        response[
            "Cross-Origin-Resource-Policy"
        ] = "cross-origin"
        return response

    target = resolve_upload_path(
        document.get("path")
    )

    if not target:
        return Response(
            {
                "detail": (
                    "Document file not found."
                )
            },
            status=status.HTTP_404_NOT_FOUND,
        )

    response = FileResponse(
        open(target, "rb"),
        content_type=document.get("mime")
        or "application/octet-stream",
    )
    safe_name = document.get(
        "name",
        "document",
    ).replace('"', "")

    response["Content-Disposition"] = (
        f'inline; filename="{safe_name}"'
    )
    response["Cache-Control"] = (
        "private, max-age=3600"
    )
    response["X-Content-Type-Options"] = (
        "nosniff"
    )

    return response


@api_view(["GET"])
def application_agenda(request):
    db = get_db()
    owner_id = _owner_oid(request)
    now = utcnow()
    horizon_days = _number(
        request.query_params.get(
            "days",
            30,
        ),
        default=30,
        minimum=1,
        maximum=365,
    )
    horizon = now + timedelta(
        days=horizon_days
    )

    applications = {
        doc["_id"]: doc
        for doc in db.job_applications.find(
            {
                "owner_id": owner_id,
                "archived": {"$ne": True},
            }
        )
    }

    application_ids = list(
        applications.keys()
    )

    if not application_ids:
        return Response(
            {
                "items": [],
                "overdue": 0,
                "due_today": 0,
                "upcoming": 0,
            }
        )

    items = []

    tasks = db.application_tasks.find(
        {
            "owner_id": owner_id,
            "application_id": {
                "$in": application_ids
            },
            "completed": {"$ne": True},
            "due_at": {"$ne": None},
        }
    )

    for task in tasks:
        application = applications.get(
            task["application_id"]
        )

        if not application:
            continue

        due_at = task.get("due_at")
        reminder_at = task.get("reminder_at")

        if (
            reminder_at
            and reminder_at <= horizon
        ):
            items.append(
                {
                    "id": (
                        f"reminder-{task['_id']}"
                    ),
                    "type": "reminder",
                    "application_id": str(
                        application["_id"]
                    ),
                    "company": application.get(
                        "company",
                        "",
                    ),
                    "job_title": application.get(
                        "title",
                        "",
                    ),
                    "title": (
                        f"Reminder: "
                        f"{task.get('title', '')}"
                    ),
                    "at": serialize_datetime(
                        reminder_at
                    ),
                    "priority": task.get(
                        "priority",
                        "medium",
                    ),
                }
            )

        if (
            due_at
            and due_at <= horizon
        ):
            items.append(
                {
                    "id": str(task["_id"]),
                    "type": "task",
                    "application_id": str(
                        application["_id"]
                    ),
                    "company": application.get(
                        "company",
                        "",
                    ),
                    "job_title": application.get(
                        "title",
                        "",
                    ),
                    "title": task.get(
                        "title",
                        "",
                    ),
                    "at": serialize_datetime(
                        due_at
                    ),
                    "priority": task.get(
                        "priority",
                        "medium",
                    ),
                }
            )

    interviews = (
        db.application_interviews.find(
            {
                "owner_id": owner_id,
                "application_id": {
                    "$in": application_ids
                },
                "completed": {"$ne": True},
                "scheduled_at": {
                    "$gte": now - timedelta(
                        hours=12
                    ),
                    "$lte": horizon,
                },
            }
        )
    )

    for interview in interviews:
        application = applications.get(
            interview["application_id"]
        )

        if not application:
            continue

        items.append(
            {
                "id": str(interview["_id"]),
                "type": "interview",
                "application_id": str(
                    application["_id"]
                ),
                "company": application.get(
                    "company",
                    "",
                ),
                "job_title": application.get(
                    "title",
                    "",
                ),
                "title": interview.get(
                    "title",
                    "Interview",
                ),
                "at": serialize_datetime(
                    interview.get(
                        "scheduled_at"
                    )
                ),
                "priority": "high",
            }
        )

    for application in applications.values():
        deadline = application.get(
            "deadline_at"
        )

        if (
            deadline
            and deadline <= horizon
        ):
            items.append(
                {
                    "id": (
                        f"deadline-"
                        f"{application['_id']}"
                    ),
                    "type": "deadline",
                    "application_id": str(
                        application["_id"]
                    ),
                    "company": application.get(
                        "company",
                        "",
                    ),
                    "job_title": application.get(
                        "title",
                        "",
                    ),
                    "title": (
                        "Application deadline"
                    ),
                    "at": serialize_datetime(
                        deadline
                    ),
                    "priority": "urgent",
                }
            )

    items.sort(
        key=lambda item: item.get("at") or ""
    )

    today = now.date()
    overdue = 0
    due_today = 0
    upcoming = 0

    for item in items:
        at = _datetime(item.get("at"))

        if not at:
            continue

        if at < now:
            overdue += 1
        elif at.date() == today:
            due_today += 1
        else:
            upcoming += 1

    return Response(
        {
            "items": items[:100],
            "overdue": overdue,
            "due_today": due_today,
            "upcoming": upcoming,
            "horizon_days": horizon_days,
        }
    )


@api_view(["GET"])
def application_analytics(request):
    db = get_db()
    owner_id = _owner_oid(request)

    applications = list(
        db.job_applications.find(
            {
                "owner_id": owner_id,
                "archived": {"$ne": True},
            }
        )
    )

    stage_order = [
        "saved",
        "applied",
        "screening",
        "interview",
        "offer",
        "rejected",
    ]
    stage_counts = Counter(
        doc.get("status", "saved")
        for doc in applications
    )

    source_counts = Counter(
        doc.get("source_platform", "")
        for doc in applications
        if doc.get("source_platform")
    )
    company_counts = Counter(
        doc.get("company", "")
        for doc in applications
        if doc.get("company")
    )
    category_counts = Counter(
        doc.get("category", "")
        for doc in applications
        if doc.get("category")
    )
    priority_counts = Counter(
        doc.get("priority", "medium")
        for doc in applications
    )

    monthly = defaultdict(
        lambda: {
            "tracked": 0,
            "applied": 0,
            "offers": 0,
            "interviews": 0,
        }
    )

    now = utcnow()
    start_month = datetime(
        now.year,
        now.month,
        1,
        tzinfo=timezone.utc,
    )

    allowed_months = []

    for offset in range(11, -1, -1):
        year = start_month.year
        month = start_month.month - offset

        while month <= 0:
            month += 12
            year -= 1

        key = f"{year:04d}-{month:02d}"
        allowed_months.append(key)
        monthly[key]

    allowed_set = set(allowed_months)

    for application in applications:
        created_at = application.get(
            "created_at"
        )
        applied_at = application.get(
            "applied_at"
        )

        if created_at:
            key = created_at.strftime(
                "%Y-%m"
            )
            if key in allowed_set:
                monthly[key][
                    "tracked"
                ] += 1

        if applied_at:
            key = applied_at.strftime(
                "%Y-%m"
            )
            if key in allowed_set:
                monthly[key][
                    "applied"
                ] += 1

        if application.get("status") == "offer":
            changed = application.get(
                "status_changed_at"
            ) or application.get(
                "updated_at"
            )

            if changed:
                key = changed.strftime(
                    "%Y-%m"
                )
                if key in allowed_set:
                    monthly[key][
                        "offers"
                    ] += 1

    interviews = list(
        db.application_interviews.find(
            {
                "owner_id": owner_id,
                "application_id": {
                    "$in": [
                        doc["_id"]
                        for doc in applications
                    ]
                },
            }
        )
    ) if applications else []

    for interview in interviews:
        scheduled_at = interview.get(
            "scheduled_at"
        )

        if scheduled_at:
            key = scheduled_at.strftime(
                "%Y-%m"
            )
            if key in allowed_set:
                monthly[key][
                    "interviews"
                ] += 1

    response_durations = []

    application_ids = [
        doc["_id"]
        for doc in applications
    ]

    if application_ids:
        events = list(
            db.application_events.find(
                {
                    "owner_id": owner_id,
                    "application_id": {
                        "$in": application_ids
                    },
                    "kind": "status",
                    "to_status": {
                        "$in": [
                            "screening",
                            "interview",
                            "offer",
                            "rejected",
                        ]
                    },
                }
            ).sort("created_at", ASCENDING)
        )

        first_response = {}

        for event in events:
            application_id = event.get(
                "application_id"
            )

            if application_id not in first_response:
                first_response[
                    application_id
                ] = event.get("created_at")

        by_id = {
            doc["_id"]: doc
            for doc in applications
        }

        for application_id, response_at in (
            first_response.items()
        ):
            application = by_id.get(
                application_id
            )

            if (
                not application
                or not response_at
            ):
                continue

            applied_at = application.get(
                "applied_at"
            ) or application.get(
                "created_at"
            )

            if (
                applied_at
                and response_at >= applied_at
            ):
                days = (
                    response_at - applied_at
                ).total_seconds() / 86400
                response_durations.append(days)

    average_response_days = (
        round(
            sum(response_durations)
            / len(response_durations),
            1,
        )
        if response_durations
        else 0
    )

    submitted = sum(
        1
        for doc in applications
        if doc.get("status") != "saved"
    )
    responses = sum(
        stage_counts.get(key, 0)
        for key in (
            "screening",
            "interview",
            "offer",
            "rejected",
        )
    )
    offers = stage_counts.get(
        "offer",
        0,
    )
    interviews_count = (
        stage_counts.get("interview", 0)
        + offers
    )

    def top_items(counter, label_key):
        return [
            {
                label_key: key,
                "count": value,
            }
            for key, value in counter.most_common(
                10
            )
            if key
        ]

    return Response(
        {
            "overview": {
                "tracked": len(
                    applications
                ),
                "submitted": submitted,
                "responses": responses,
                "interviews": (
                    interviews_count
                ),
                "offers": offers,
                "response_rate": (
                    round(
                        responses
                        / max(submitted, 1)
                        * 100,
                        1,
                    )
                    if submitted
                    else 0
                ),
                "interview_rate": (
                    round(
                        interviews_count
                        / max(submitted, 1)
                        * 100,
                        1,
                    )
                    if submitted
                    else 0
                ),
                "offer_rate": (
                    round(
                        offers
                        / max(submitted, 1)
                        * 100,
                        1,
                    )
                    if submitted
                    else 0
                ),
                "average_response_days": (
                    average_response_days
                ),
            },
            "pipeline": [
                {
                    "status": key,
                    "count": stage_counts.get(
                        key,
                        0,
                    ),
                }
                for key in stage_order
            ],
            "monthly": [
                {
                    "month": key,
                    **monthly[key],
                }
                for key in allowed_months
            ],
            "sources": top_items(
                source_counts,
                "source",
            ),
            "companies": top_items(
                company_counts,
                "company",
            ),
            "categories": top_items(
                category_counts,
                "category",
            ),
            "priorities": [
                {
                    "priority": key,
                    "count": priority_counts.get(
                        key,
                        0,
                    ),
                }
                for key in (
                    "urgent",
                    "high",
                    "medium",
                    "low",
                )
            ],
        }
    )
