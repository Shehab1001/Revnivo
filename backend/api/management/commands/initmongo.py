from django.conf import settings
from django.core.management.base import BaseCommand

from api.mongo import ensure_indexes, get_db


class Command(BaseCommand):
    help = "Ping MongoDB, create Revnivo indexes, and apply explicit admin bootstrap settings."

    def handle(self, *args, **options):
        db = get_db()
        db.command("ping")
        ensure_indexes()

        if settings.SUPERADMIN_EMAIL:
            result = db.users.update_one(
                {"email": settings.SUPERADMIN_EMAIL},
                {"$set": {"role": "admin"}},
            )
            if result.matched_count:
                self.stdout.write(
                    self.style.SUCCESS(
                        f"Superadmin role verified for {settings.SUPERADMIN_EMAIL}."
                    )
                )
            else:
                self.stdout.write(
                    self.style.WARNING(
                        "SUPERADMIN_EMAIL is configured but no matching account exists yet. "
                        "Create the account first, then rerun initmongo."
                    )
                )

        self.stdout.write(
            self.style.SUCCESS("MongoDB connection OK. Indexes are ready.")
        )
