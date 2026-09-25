class SecurityHeadersMiddleware:
    """
    Small defense-in-depth layer for API responses.
    CSP is intentionally left to the frontend web server because the React app
    loads Google Identity and fonts from explicitly configured external origins.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        response.setdefault("Permissions-Policy", "camera=(), geolocation=(), payment=(), usb=()")
        response.setdefault("X-Permitted-Cross-Domain-Policies", "none")
        response.setdefault("Cross-Origin-Resource-Policy", "same-site")

        if request.path.startswith("/api/auth/"):
            response["Cache-Control"] = "no-store, private"
            response["Pragma"] = "no-cache"

        return response
