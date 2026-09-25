import shutil
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand

from api.mongo import get_db


class Command(BaseCommand):
    help = "Move legacy chat attachments from public media into private_media."

    def handle(self, *args, **options):
        db = get_db()
        public_root = Path(settings.MEDIA_ROOT).resolve()
        private_root = Path(settings.PRIVATE_MEDIA_ROOT).resolve()
        moved = 0
        missing = 0

        for message in db.chat_messages.find(
            {"attachment": {"$exists": True, "$ne": ""}},
            {"attachment": 1},
        ):
            relative = str(message.get("attachment") or "").replace("\\", "/").lstrip("/")
            if not relative.startswith("chat/"):
                continue

            source = (public_root / relative).resolve()
            target = (private_root / relative).resolve()

            if public_root not in source.parents or private_root not in target.parents:
                continue

            if target.is_file():
                continue

            if not source.is_file():
                missing += 1
                continue

            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(source), str(target))
            moved += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Moved {moved} legacy chat attachment(s) to private storage. "
                f"{missing} referenced file(s) were not found locally."
            )
        )
