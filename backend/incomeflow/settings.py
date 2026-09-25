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
TIME_ZONE = "Africa/Cairo"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://127.0.0.1:27017")
MONGODB_DB = os.getenv("MONGODB_DB", "revnivo")
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", SECRET_KEY)
JWT_ALGORITHM = "HS256"
JWT_EXP_MINUTES = int(os.getenv("JWT_EXP_MINUTES", "10080"))  # 7 days
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "").strip()
EGP_PER_USD = Decimal(os.getenv("EGP_PER_USD", "50.00"))
EGP_RATE_API_URL = os.getenv("EGP_RATE_API_URL", "https://open.er-api.com/v6/latest/USD")
EGP_RATE_CACHE_SECONDS = int(os.getenv("EGP_RATE_CACHE_SECONDS", "3600"))
EMAIL_BACKEND = os.getenv("EMAIL_BACKEND", "django.core.mail.backends.smtp.EmailBackend")
EMAIL_HOST = os.getenv("EMAIL_HOST", "")
EMAIL_PORT = int(os.getenv("EMAIL_PORT", "587"))
EMAIL_HOST_USER = os.getenv("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD", "")
EMAIL_USE_TLS = os.getenv("EMAIL_USE_TLS", "true").lower() == "true"
DEFAULT_FROM_EMAIL = os.getenv("DEFAULT_FROM_EMAIL", EMAIL_HOST_USER or "noreply@revnivo.local")
PASSWORD_RESET_OTP_MINUTES = int(os.getenv("PASSWORD_RESET_OTP_MINUTES", "10"))

# Paymob Unified Checkout (Egypt by default).
# Keep secret and HMAC keys server-side only.
PAYMOB_BASE_URL = os.getenv("PAYMOB_BASE_URL", "https://accept.paymob.com").rstrip("/")
PAYMOB_SECRET_KEY = os.getenv("PAYMOB_SECRET_KEY", "").strip()
PAYMOB_PUBLIC_KEY = os.getenv("PAYMOB_PUBLIC_KEY", "").strip()
PAYMOB_HMAC_SECRET = os.getenv("PAYMOB_HMAC_SECRET", "").strip()
PAYMOB_INTEGRATION_ID_CARD = os.getenv("PAYMOB_INTEGRATION_ID_CARD", "").strip()
PAYMOB_CURRENCY = os.getenv("PAYMOB_CURRENCY", "EGP").strip().upper()
PAYMOB_WEBHOOK_URL = os.getenv("PAYMOB_WEBHOOK_URL", "").strip()
PAYMOB_REDIRECT_URL = os.getenv("PAYMOB_REDIRECT_URL", "").strip()

FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
CORS_ALLOWED_ORIGINS = [FRONTEND_ORIGIN]
CORS_ALLOW_CREDENTIALS = False

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ["api.authentication.MongoJWTAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "UNAUTHENTICATED_USER": None,
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
}
