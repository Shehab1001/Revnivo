import os
from decimal import Decimal
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


def env_bool(name, default=False):
    return os.getenv(name, str(default)).strip().lower() in {"1", "true", "yes", "on"}


def env_list(name, default=""):
    return [item.strip() for item in os.getenv(name, default).split(",") if item.strip()]


DEBUG = env_bool("DJANGO_DEBUG", True)
SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "").strip()

if not SECRET_KEY:
    if DEBUG:
        SECRET_KEY = "dev-only-django-secret-change-me"
    else:
        raise RuntimeError("DJANGO_SECRET_KEY must be configured when DJANGO_DEBUG=false.")

if not DEBUG and len(SECRET_KEY) < 32:
    raise RuntimeError("DJANGO_SECRET_KEY must be at least 32 characters in production.")

ALLOWED_HOSTS = (
    ["localhost", "127.0.0.1"]
    if DEBUG
    else env_list("ALLOWED_HOSTS")
)

if not DEBUG and not ALLOWED_HOSTS:
    raise RuntimeError("ALLOWED_HOSTS must be configured in production.")

INSTALLED_APPS = [
    "corsheaders",
    "rest_framework",
    "api",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "api.middleware.SecurityHeadersMiddleware",
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
PRIVATE_MEDIA_ROOT = BASE_DIR / "private_media"

# Upload limits are enforced both by Django and api.utils.
DATA_UPLOAD_MAX_MEMORY_SIZE = int(os.getenv("DATA_UPLOAD_MAX_MEMORY_SIZE", str(2 * 1024 * 1024)))
FILE_UPLOAD_MAX_MEMORY_SIZE = int(os.getenv("FILE_UPLOAD_MAX_MEMORY_SIZE", str(2 * 1024 * 1024)))

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://127.0.0.1:27017")
MONGODB_DB = os.getenv("MONGODB_DB", "revnivo")

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", SECRET_KEY).strip()
JWT_ALGORITHM = "HS256"
JWT_EXP_MINUTES = int(os.getenv("JWT_EXP_MINUTES", "480"))
JWT_ISSUER = os.getenv("JWT_ISSUER", "revnivo-api").strip()
JWT_AUDIENCE = os.getenv("JWT_AUDIENCE", "revnivo-web").strip()
AUTH_COOKIE_NAME = os.getenv("AUTH_COOKIE_NAME", "revnivo_session").strip()
AUTH_CSRF_COOKIE_NAME = os.getenv("AUTH_CSRF_COOKIE_NAME", "revnivo_csrf").strip()
AUTH_COOKIE_DOMAIN = os.getenv("AUTH_COOKIE_DOMAIN", "").strip()
AUTH_COOKIE_SECURE = env_bool("AUTH_COOKIE_SECURE", not DEBUG)
AUTH_COOKIE_SAMESITE = os.getenv("AUTH_COOKIE_SAMESITE", "Lax").strip().capitalize()
if AUTH_COOKIE_SAMESITE not in {"Lax", "Strict", "None"}:
    AUTH_COOKIE_SAMESITE = "Lax"
if AUTH_COOKIE_SAMESITE == "None" and not AUTH_COOKIE_SECURE:
    raise RuntimeError("SameSite=None authentication cookies require AUTH_COOKIE_SECURE=true.")

if not DEBUG and len(JWT_SECRET_KEY) < 32:
    raise RuntimeError("JWT_SECRET_KEY must be at least 32 characters in production.")

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "").strip()
SUPERADMIN_EMAIL = os.getenv("SUPERADMIN_EMAIL", "").strip().lower()

EGP_PER_USD = Decimal(os.getenv("EGP_PER_USD", "50.00"))
EGP_RATE_API_URL = os.getenv("EGP_RATE_API_URL", "https://open.er-api.com/v6/latest/USD")
EGP_RATE_CACHE_SECONDS = int(os.getenv("EGP_RATE_CACHE_SECONDS", "3600"))

EMAIL_BACKEND = os.getenv("EMAIL_BACKEND", "django.core.mail.backends.smtp.EmailBackend")
EMAIL_HOST = os.getenv("EMAIL_HOST", "")
EMAIL_PORT = int(os.getenv("EMAIL_PORT", "587"))
EMAIL_HOST_USER = os.getenv("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD", "")
EMAIL_USE_TLS = env_bool("EMAIL_USE_TLS", True)
DEFAULT_FROM_EMAIL = os.getenv("DEFAULT_FROM_EMAIL", EMAIL_HOST_USER or "noreply@revnivo.local")
PASSWORD_RESET_OTP_MINUTES = int(os.getenv("PASSWORD_RESET_OTP_MINUTES", "10"))
PASSWORD_RESET_COOLDOWN_SECONDS = int(os.getenv("PASSWORD_RESET_COOLDOWN_SECONDS", "60"))

# Paymob Unified Checkout. Secrets remain server-side only.
PAYMOB_BASE_URL = os.getenv("PAYMOB_BASE_URL", "https://accept.paymob.com").rstrip("/")
PAYMOB_SECRET_KEY = os.getenv("PAYMOB_SECRET_KEY", "").strip()
PAYMOB_PUBLIC_KEY = os.getenv("PAYMOB_PUBLIC_KEY", "").strip()
PAYMOB_HMAC_SECRET = os.getenv("PAYMOB_HMAC_SECRET", "").strip()
PAYMOB_INTEGRATION_ID_CARD = os.getenv("PAYMOB_INTEGRATION_ID_CARD", "").strip()
PAYMOB_CURRENCY = os.getenv("PAYMOB_CURRENCY", "EGP").strip().upper()
PAYMOB_WEBHOOK_URL = os.getenv("PAYMOB_WEBHOOK_URL", "").strip()
PAYMOB_REDIRECT_URL = os.getenv("PAYMOB_REDIRECT_URL", "").strip()

FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173").rstrip("/")
CORS_ALLOWED_ORIGINS = [FRONTEND_ORIGIN]
CORS_ALLOW_CREDENTIALS = True
CORS_EXPOSE_HEADERS = ["X-CSRF-Token"]
CORS_ALLOW_HEADERS = [
    "accept",
    "authorization",
    "content-type",
    "origin",
    "user-agent",
    "x-csrftoken",
    "x-csrf-token",
    "x-requested-with",
]

CSRF_TRUSTED_ORIGINS = env_list("CSRF_TRUSTED_ORIGINS", FRONTEND_ORIGIN)

# Secure deployment defaults. They are active in production and harmless in local DEBUG mode.
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "strict-origin-when-cross-origin"
X_FRAME_OPTIONS = "DENY"
SECURE_CROSS_ORIGIN_OPENER_POLICY = "same-origin"
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
USE_X_FORWARDED_HOST = env_bool("USE_X_FORWARDED_HOST", False)
SECURE_SSL_REDIRECT = env_bool("SECURE_SSL_REDIRECT", not DEBUG)
SECURE_HSTS_SECONDS = int(os.getenv("SECURE_HSTS_SECONDS", "31536000" if not DEBUG else "0"))
SECURE_HSTS_INCLUDE_SUBDOMAINS = env_bool("SECURE_HSTS_INCLUDE_SUBDOMAINS", not DEBUG)
SECURE_HSTS_PRELOAD = env_bool("SECURE_HSTS_PRELOAD", False)

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ["api.authentication.MongoJWTAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "UNAUTHENTICATED_USER": None,
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_THROTTLE_CLASSES": [
        "api.throttles.ApiBurstThrottle",
        "api.throttles.ApiSustainedThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        # Revnivo uses authenticated polling for notifications, presence,
        # and chat updates. Keep a strict short-window burst limit while
        # allowing enough legitimate daily requests for an active session.
        "api_burst": os.getenv("API_BURST_RATE", "120/min"),
        "api_sustained": os.getenv("API_SUSTAINED_RATE", "150000/day"),
    },
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 10}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]
