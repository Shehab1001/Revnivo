from copy import deepcopy

from django.core.management.base import BaseCommand
from pymongo import MongoClient

from api.utils import utcnow


class Command(BaseCommand):
    help = "Merge legacy incomeflow MongoDB data into revnivo by user email."

    def handle(self, *args, **options):
        client = MongoClient("mongodb://127.0.0.1:27017")
        source = client["incomeflow"]
        target = client["revnivo"]

        user_ids = {}
        for source_user in source.users.find({}):
            email = source_user.get("email", "").lower()
            if not email:
                continue
            target_user = target.users.find_one({"email": email})
            if not target_user:
                target_user = deepcopy(source_user)
                target.users.insert_one(target_user)
            else:
                updates = {}
                for key in ("name", "role", "profile_image", "google_picture", "trial_ends_at", "subscription_status", "payment_method"):
                    if source_user.get(key) is not None and target_user.get(key) in (None, "", "user", "trial"):
                        updates[key] = source_user[key]
                if updates:
                    target.users.update_one({"_id": target_user["_id"]}, {"$set": updates})
            user_ids[source_user["_id"]] = target_user["_id"]

        platform_ids = {}
        for platform in source.platforms.find({}):
            owner_id = user_ids.get(platform.get("owner_id"))
            if not owner_id:
                continue
            existing = target.platforms.find_one({"owner_id": owner_id, "name": platform.get("name", "")})
            if not existing:
                copied = deepcopy(platform)
                copied["owner_id"] = owner_id
                target.platforms.insert_one(copied)
                existing = copied
            platform_ids[platform["_id"]] = existing["_id"]

        for collection_name in ("earnings", "notes"):
            source_collection = source[collection_name]
            target_collection = target[collection_name]
            for document in source_collection.find({}):
                owner_id = user_ids.get(document.get("owner_id"))
                if not owner_id:
                    continue
                copied = deepcopy(document)
                copied["owner_id"] = owner_id
                if collection_name == "earnings":
                    platform_id = platform_ids.get(document.get("platform_id"))
                    if not platform_id:
                        continue
                    copied["platform_id"] = platform_id
                    duplicate_query = {
                        "owner_id": owner_id,
                        "platform_id": platform_id,
                        "amount": copied.get("amount"),
                        "currency": copied.get("currency"),
                        "earned_at": copied.get("earned_at"),
                        "category": copied.get("category", ""),
                        "note": copied.get("note", ""),
                    }
                else:
                    duplicate_query = {"owner_id": owner_id, "title": copied.get("title", ""), "content": copied.get("content", "")}
                if not target_collection.find_one(duplicate_query):
                    target_collection.insert_one(copied)

        for collection_name in ("subscription_plans", "subscription_coupons", "settings"):
            if source[collection_name].count_documents({}) and target[collection_name].count_documents({}) == 0:
                target[collection_name].insert_many([deepcopy(item) for item in source[collection_name].find({})])

        self.stdout.write(self.style.SUCCESS("Legacy data merged into revnivo without duplicate earnings or notes."))
