# Deploy Revnivo frontend to Vercel

Revnivo uses:

- Frontend: Vercel at `https://revnivo.vercel.app`
- Backend: Railway at `https://revnivo-production.up.railway.app`
- Database: MongoDB Atlas
- Production media: Cloudinary

## Vercel project

Use the `V1.1` branch while testing and set the Vercel project Root Directory to:

```text
frontend
```

The Vite app builds with:

```text
npm run build
```

and outputs:

```text
dist
```

## Environment variables

Set:

```text
VITE_GOOGLE_CLIENT_ID=<your Google OAuth web client id>
```

Leave `VITE_API_URL` unset/blank in production.

The `frontend/vercel.json` rewrites `/api/*` and `/media/*` to Railway so browser requests stay on the Vercel origin. It also provides the SPA fallback to `index.html` for React Router deep links.

## Railway production origin

Set/update these Railway variables:

```text
DJANGO_DEBUG=false
FRONTEND_ORIGIN=https://revnivo.vercel.app
CORS_ALLOWED_ORIGINS=https://revnivo.vercel.app
CSRF_TRUSTED_ORIGINS=https://revnivo.vercel.app
AUTH_COOKIE_SECURE=true
AUTH_COOKIE_SAMESITE=Lax
PAYMOB_REDIRECT_URL=https://revnivo.vercel.app/payments?provider=paymob
```

Keep the existing production values for MongoDB, Cloudinary, Django/JWT secrets, SMTP, Paymob secrets, and Google client ID.

## Google Sign-In

Add this Authorized JavaScript origin in Google Cloud Console:

```text
https://revnivo.vercel.app
```

Use the same client ID in:

- Vercel: `VITE_GOOGLE_CLIENT_ID`
- Railway: `GOOGLE_CLIENT_ID`

## Smoke test

After deployment, test:

- Register/login/logout
- Refresh while logged in
- Google Sign-In
- Dashboard
- Earnings/platform CRUD
- Jobs and application tracker
- Resume Studio import/ATS requests
- Notes attachments
- Support Chat text/image upload
- Password reset email flow
- Payments redirect if enabled
