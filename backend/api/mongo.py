from functools import lru_cache

from django.conf import settings
from pymongo import ASCENDING, DESCENDING, MongoClient


@lru_cache(maxsize=1)
def get_client():
    return MongoClient(
        settings.MONGODB_URI,
        serverSelectionTimeoutMS=5000,
        connectTimeoutMS=5000,
        socketTimeoutMS=10000,
        retryWrites=True,
    )


def get_db():
    return get_client()[settings.MONGODB_DB]


def ensure_indexes():
    db = get_db()

    db.users.create_index([("email", ASCENDING)], unique=True)
    db.users.create_index([("role", ASCENDING)])

    db.platforms.create_index([("owner_id", ASCENDING), ("name", ASCENDING)])
    db.platforms.create_index([("owner_id", ASCENDING), ("is_archived", ASCENDING)])

    db.earnings.create_index([("owner_id", ASCENDING), ("earned_at", DESCENDING)])
    db.earnings.create_index([("owner_id", ASCENDING), ("platform_id", ASCENDING)])
    db.earnings.create_index(
        [("owner_id", ASCENDING), ("currency", ASCENDING), ("earned_at", DESCENDING)]
    )

    db.notes.create_index([("owner_id", ASCENDING), ("updated_at", DESCENDING)])
    db.income_goals.create_index([("owner_id", ASCENDING)], unique=True)
    db.notifications.create_index([("owner_id", ASCENDING), ("created_at", DESCENDING)])
    db.chat_messages.create_index([("user_id", ASCENDING), ("created_at", ASCENDING)])

    db.password_reset_otps.create_index([("email", ASCENDING)], unique=True)
    db.password_reset_otps.create_index([("expires_at", ASCENDING)], expireAfterSeconds=0)

    db.payment_transactions.create_index(
        [("owner_id", ASCENDING), ("created_at", DESCENDING)]
    )
    db.payment_transactions.create_index(
        [("paymob_order_id", ASCENDING)],
        unique=True,
        sparse=True,
    )
    db.payment_transactions.create_index(
        [("provider_transaction_id", ASCENDING)],
        unique=True,
        sparse=True,
    )

    db.payment_methods.create_index([("code", ASCENDING)], unique=True)
