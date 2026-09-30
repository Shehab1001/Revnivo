from rest_framework.throttling import AnonRateThrottle, UserRateThrottle


class AuthBurstThrottle(AnonRateThrottle):
    """Tight per-IP limit for login and third-party authentication endpoints."""

    rate = "10/min"


class RegistrationThrottle(AnonRateThrottle):
    """Limit automated account creation from one client IP."""

    rate = "5/min"


class PasswordResetThrottle(AnonRateThrottle):
    """Slow OTP generation and guessing attempts from one client IP."""

    rate = "5/min"


class ApiBurstThrottle(UserRateThrottle):
    scope = "api_burst"


class ApiSustainedThrottle(UserRateThrottle):
    scope = "api_sustained"
