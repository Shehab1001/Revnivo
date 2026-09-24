from functools import lru_cache
from django.conf import settings
from pymongo import ASCENDING, DESCENDING, MongoClient

@lru_cache(maxsize=1)
def get_client():
    return MongoClient(settings.MONGODB_URI, serverSelectionTimeoutMS=5000)


def get_db():
    return get_client()[settings.MONGODB_DB]


def ensure_indexes():
    db = get_db()
    db.users.create_index([("email", ASCENDING)], unique=True)
    db.platforms.create_index([("owner_id", ASCENDING), ("name", ASCENDING)])
    db.earnings.create_index([("owner_id", ASCENDING), ("earned_at", DESCENDING)])
    db.earnings.create_index([("owner_id", ASCENDING), ("platform_id", ASCENDING)])
    db.earnings.create_index([("owner_id", ASCENDING), ("currency", ASCENDING), ("earned_at", DESCENDING)])
    db.notes.create_index([("owner_id", ASCENDING), ("updated_at", DESCENDING)])
    db.notifications.create_index([("owner_id", ASCENDING), ("created_at", DESCENDING)])
    db.chat_messages.create_index([("user_id", ASCENDING), ("created_at", ASCENDING)])
    db.password_reset_otps.create_index([("email", ASCENDING)], unique=True)
    db.password_reset_otps.create_index([("expires_at", ASCENDING)], expireAfterSeconds=0)
