from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from api.mongo import get_db
from api.utils import (
    is_cloudinary_ref,
    migrate_local_upload,
    resolve_upload_path,
)


class Command(BaseCommand):
    help = (
        "Upload legacy Revnivo media/private_media files to Cloudinary and "
        "replace MongoDB file references with Cloudinary storage references."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--delete-local",
            action="store_true",
            help="Delete each local file only after its MongoDB reference was updated successfully.",
        )

    def handle(self, *args, **options):
        if not getattr(settings, "CLOUDINARY_URL", "").strip():
            raise CommandError("CLOUDINARY_URL must be configured before migrating media.")

        db = get_db()
        delete_local = bool(options.get("delete_local"))
        uploaded = 0
        updated = 0
        missing = 0
        deleted = 0

        def prepare(reference):
            nonlocal uploaded, missing
            if not reference or is_cloudinary_ref(reference):
                return reference, None

            local_target = resolve_upload_path(reference)
            if not local_target:
                missing += 1
                self.stderr.write(self.style.WARNING(f"Missing local file: {reference}"))
                return reference, None

            new_reference = migrate_local_upload(reference)
            uploaded += 1
            return new_reference, local_target

        def remove_after_update(local_target):
            nonlocal deleted
            if not delete_local or not local_target:
                return
            try:
                local_target.unlink(missing_ok=True)
                deleted += 1
            except OSError as exc:
                self.stderr.write(
                    self.style.WARNING(f"Could not delete {local_target}: {exc}")
                )

        for user in db.users.find(
            {"profile_image": {"$exists": True, "$nin": ["", None]}},
            {"profile_image": 1},
        ):
            old = user.get("profile_image")
            new, local_target = prepare(old)
            if new != old:
                db.users.update_one({"_id": user["_id"]}, {"$set": {"profile_image": new}})
                updated += 1
                remove_after_update(local_target)

        for platform in db.platforms.find(
            {"logo": {"$exists": True, "$nin": ["", None]}},
            {"logo": 1},
        ):
            old = platform.get("logo")
            new, local_target = prepare(old)
            if new != old:
                db.platforms.update_one({"_id": platform["_id"]}, {"$set": {"logo": new}})
                updated += 1
                remove_after_update(local_target)

        for message in db.chat_messages.find(
            {"attachment": {"$exists": True, "$nin": ["", None]}},
            {"attachment": 1},
        ):
            old = message.get("attachment")
            new, local_target = prepare(old)
            if new != old:
                db.chat_messages.update_one(
                    {"_id": message["_id"]},
                    {"$set": {"attachment": new}},
                )
                updated += 1
                remove_after_update(local_target)

        for note in db.notes.find(
            {"attachments.0": {"$exists": True}},
            {"attachments": 1},
        ):
            attachments = note.get("attachments", []) or []
            changed = False
            local_targets = []
            migrated = []

            for attachment in attachments:
                item = dict(attachment)
                old = item.get("path")
                new, local_target = prepare(old)
                if new != old:
                    item["path"] = new
                    changed = True
                    if local_target:
                        local_targets.append(local_target)
                migrated.append(item)

            if changed:
                db.notes.update_one(
                    {"_id": note["_id"]},
                    {"$set": {"attachments": migrated}},
                )
                updated += 1
                for local_target in local_targets:
                    remove_after_update(local_target)

        self.stdout.write(
            self.style.SUCCESS(
                f"Cloudinary migration complete: {uploaded} file(s) uploaded, "
                f"{updated} MongoDB document(s) updated, {missing} missing "
                f"file(s), {deleted} local file(s) deleted."
            )
        )
