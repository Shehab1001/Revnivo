from django.core.management.base import BaseCommand
from api.mongo import ensure_indexes, get_db

class Command(BaseCommand):
    help = "Ping MongoDB and create IncomeFlow indexes."

    def handle(self, *args, **options):
        get_db().command("ping")
        ensure_indexes()
        self.stdout.write(self.style.SUCCESS("MongoDB connection OK. Indexes are ready."))
