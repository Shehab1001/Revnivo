# Revnivo security

This repository includes application-level hardening, but production security also depends on deployment configuration and secret handling.

## Production requirements

Before exposing Revnivo to the Internet:

1. Set `DJANGO_DEBUG=false`.
2. Generate separate long random values for `DJANGO_SECRET_KEY` and `JWT_SECRET_KEY`.
3. Configure exact `ALLOWED_HOSTS`, `FRONTEND_ORIGIN`, and `CSRF_TRUSTED_ORIGINS`.
4. Use HTTPS only and set `AUTH_COOKIE_SECURE=true`.
5. Keep `AUTH_COOKIE_SAMESITE=Lax` when frontend/API are same-site. If they are intentionally cross-site, use `None` only together with Secure cookies.
6. Set `SUPERADMIN_EMAIL` to the existing account that should be protected as the superadmin, then run:
   ```
   python manage.py initmongo
   ```
7. Use a MongoDB deployment that is not publicly exposed. For Atlas, restrict network access and use a least-privilege database user.
8. Keep Paymob secret/HMAC keys only in the backend environment.
9. Run the application behind a production WSGI/ASGI server and reverse proxy; do not use Django `runserver` for production.
10. Keep the GitHub security workflow passing before deployment.

## Legacy upload migration

New chat attachments are stored outside the public media directory and are served only through an authenticated API endpoint.

For installations that already have chat files under `backend/media/chat`, back up the server and run:

```
python manage.py privatize_chat_media
```

This moves files referenced by chat messages into `backend/private_media/chat`.

## Git history and secrets

Files that were committed to Git remain retrievable from Git history even after they are removed from the current branch.

Before production:

- Rotate every password, API key, SMTP app password, JWT secret, Django secret, payment secret, or other credential that has ever been committed.
- Back up any legitimate uploaded files that were accidentally committed under `backend/media/`.
- Remove committed user uploads and historical secrets from Git history using a history-rewrite tool such as `git filter-repo` or BFG, then force-push the cleaned repository after coordinating with all collaborators.
- Treat any credential present in old history as compromised.

## Recommended repository controls

Protect production branches (especially `main`) and require:

- pull requests before merge,
- the `Security checks` workflow,
- no force pushes,
- no branch deletion,
- review for dependency-update pull requests.

## Reporting a vulnerability

Do not disclose production secrets or private user data in a public GitHub issue. Use a private security contact/channel for vulnerability reports.
