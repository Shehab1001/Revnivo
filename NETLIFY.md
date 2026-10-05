# Deploy Revnivo frontend to Netlify

Revnivo uses a React/Vite frontend and a Django backend. The recommended
production layout is:

- Frontend: Netlify
- Backend: Render at `https://revnivo.onrender.com`
- Database: MongoDB Atlas
- Production media: Cloudinary

The repository-level `netlify.toml` is configured for this layout.

## 1. Create the Netlify site

Import the GitHub repository and deploy the `V1.1` branch while testing.

Netlify should read these values automatically from `netlify.toml`:

- Base directory: `frontend`
- Build command: `npm run build`
- Publish directory: `dist`
- Node.js: 22

Do not set a separate publish directory in the UI unless you intentionally
override the repository configuration.

## 2. Netlify environment variables

Set:

```text
VITE_GOOGLE_CLIENT_ID=<your Google OAuth web client id>
```

Do not set `VITE_API_URL` for the Netlify deployment.

When `VITE_API_URL` is unset, the frontend calls `/api` on its own Netlify
origin. Netlify then proxies those requests to the Render backend. This keeps
the browser-side authentication cookies same-origin.

## 3. Render backend environment

After Netlify gives the site its production URL, for example:

```text
https://revnivo.netlify.app
```

set/update these variables on Render:

```text
DJANGO_DEBUG=false
FRONTEND_ORIGIN=https://revnivo.netlify.app
CORS_ALLOWED_ORIGINS=https://revnivo.netlify.app
CSRF_TRUSTED_ORIGINS=https://revnivo.netlify.app
AUTH_COOKIE_SECURE=true
AUTH_COOKIE_SAMESITE=Lax
PAYMOB_REDIRECT_URL=https://revnivo.netlify.app/payments?provider=paymob
```

Keep the existing production values for MongoDB, Cloudinary, Django/JWT
secrets, SMTP, Paymob secrets, and Google client ID.

If a custom Netlify domain is added later, replace the `.netlify.app` URL
above with the final HTTPS origin and redeploy/restart the backend.

## 4. Google Sign-In

In Google Cloud Console, add the final Netlify HTTPS origin to the OAuth Web
client's Authorized JavaScript origins, for example:

```text
https://revnivo.netlify.app
```

Use the same Google client ID in:

- Netlify: `VITE_GOOGLE_CLIENT_ID`
- Render: `GOOGLE_CLIENT_ID`

## 5. SPA routing

The final catch-all redirect in `netlify.toml` sends React routes such as
`/dashboard`, `/jobs`, and `/login` to `index.html`, so browser refreshes
do not return a Netlify 404.

## 6. API proxy

These browser paths stay on the Netlify domain:

```text
/api/*   -> https://revnivo.onrender.com/api/*
/media/* -> https://revnivo.onrender.com/media/*
```

The frontend should therefore leave `VITE_API_URL` unset on Netlify.

## 7. Before merging to main

Test at minimum:

- Register/login/logout
- Page refresh while logged in
- Google Sign-In
- Dashboard
- Earnings/platform CRUD
- Jobs and application tracker
- Resume Studio import/ATS requests
- Notes attachments
- Support Chat text/image upload
- Password reset email flow
- Payments redirect if enabled

Once the Netlify deployment is stable, merge `V1.1` into `main`.
