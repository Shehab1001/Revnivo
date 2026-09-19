import os
from decimal import Decimal
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "dev-only-django-secret")
DEBUG = os.getenv("DJANGO_DEBUG", "true").lower() == "true"
ALLOWED_HOSTS = ["localhost", "127.0.0.1"] if DEBUG else [h.strip() for h in os.getenv("ALLOWED_HOSTS", "").split(",") if h.strip()]

INSTALLED_APPS = [
    "corsheaders",
    "rest_framework",
    "api",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.middleware.common.CommonMiddleware",
]

ROOT_URLCONF = "incomeflow.urls"
TEMPLATES = []
WSGI_APPLICATION = "incomeflow.wsgi.application"
ASGI_APPLICATION = "incomeflow.asgi.application"

# Django itself doesn't persist app data. MongoDB is accessed directly via PyMongo.
DATABASES = {"default": {"ENGINE": "django.db.backends.dummy"}}

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://127.0.0.1:27017")
MONGODB_DB = os.getenv("MONGODB_DB", "incomeflow")
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", SECRET_KEY)
JWT_ALGORITHM = "HS256"
JWT_EXP_MINUTES = int(os.getenv("JWT_EXP_MINUTES", "10080"))  # 7 days
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "").strip()
EGP_PER_USD = Decimal(os.getenv("EGP_PER_USD", "50.00"))
EGP_RATE_API_URL = os.getenv("EGP_RATE_API_URL", "https://open.er-api.com/v6/latest/USD")
EGP_RATE_CACHE_SECONDS = int(os.getenv("EGP_RATE_CACHE_SECONDS", "3600"))

FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
CORS_ALLOWED_ORIGINS = [FRONTEND_ORIGIN]
CORS_ALLOW_CREDENTIALS = False

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ["api.authentication.MongoJWTAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "UNAUTHENTICATED_USER": None,
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
}
