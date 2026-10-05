<div align="center">

<img src="frontend/public/logo.svg" alt="Revnivo" width="220" />

# Revnivo

**Income tracking, job discovery, application management, and career tools in one workspace.**

[![Security checks](https://github.com/Shehab1001/Revnivo/actions/workflows/security.yml/badge.svg?branch=main)](https://github.com/Shehab1001/Revnivo/actions/workflows/security.yml)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![Django](https://img.shields.io/badge/Django-5.2-092E20?logo=django&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-PyMongo-47A248?logo=mongodb&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white)
![Vercel](https://img.shields.io/badge/Frontend-Vercel-000000?logo=vercel)
![Railway](https://img.shields.io/badge/Backend-Railway-0B0D0E?logo=railway)

</div>

## Overview

Revnivo is a full-stack productivity platform for freelancers, remote workers, AI-training contributors, and professionals who manage income and career activity across multiple platforms.

The current production branch is **`main`**.

Production architecture:

```text
Browser
  │
  ▼
Vercel — React / Vite frontend
  │
  │ same-origin API proxy
  ▼
Railway — Django REST API
  │
  ├── MongoDB Atlas
  └── Cloudinary
```

Production frontend:

```text
https://revnivo.vercel.app
```

Production backend:

```text
https://revnivo-production.up.railway.app
```

---

## Main Features

### Dashboard

- Income overview cards
- Multi-currency display
- Platform and date filters
- Hide/unhide sensitive financial data
- Customizable widget order and visibility
- Sales-performance chart
- Income-by-platform chart
- Platform mix
- Recent earnings
- Monthly and yearly income goals

For new accounts, the default dashboard layout places the amount cards first, charts directly below them, recent earnings after the charts, and **Income Goals at the bottom**.

### Earnings

Earnings use a simplified **Amount** model.

The Add Income form includes:

- Platform
- Amount
- Currency
- Payment status
- Date earned
- Expected payment date for pending income
- Category
- Description

The current UI no longer asks users for separate gross amount, platform fee, or payment fee values.

CSV export uses an `Amount` column. CSV import remains backward-compatible with older files that used `Gross amount`.

### Platforms

- Add and manage income platforms
- Default currency
- Platform status
- Logos
- Ordering and archival

### Jobs Hub

The Jobs workspace aggregates and organizes opportunities from multiple remote-work, AI-training, and expert platforms.

Features include:

- Search and filtering
- Remote-only filtering
- Categories
- Sorting
- Pagination
- Source status indicators
- Platform branding
- Job tracking into the Application Tracker

Public integrations may change when external sites change their APIs, pages, or access policies.

### Application Tracker

Career CRM with:

```text
Saved → Applied → Screening → Interview → Offer → Rejected
```

Includes:

- Kanban workflow
- Drag-and-drop stages
- Priority
- Recruiter information
- Compensation
- Deadlines
- Interview rounds
- Tags
- Notes
- Tasks
- Follow-up reminders
- Documents
- Timeline
- Analytics
- Archive / restore

### Resume Studio

- Multiple resumes
- Multiple templates
- PDF, DOCX, and TXT import
- Editable resume sections
- Live preview
- Print / Save as PDF
- Resume duplication
- Version history
- Version restore
- ATS readiness analysis
- Job-description matching
- Resume-based job recommendations

ATS and relevance scores are heuristic decision-support tools and are not employer-side ATS scores or hiring predictions.

### Notes

- Personal notes
- Search
- Attachments
- Images and documents
- Private file delivery
- RTL-friendly content

### Support Chat

- User ↔ support chat
- Admin ↔ admin conversations
- Images
- Voice messages
- Presence
- Conversation previews
- User avatars
- Branded support identity

### Payments & Administration

- Subscription plans
- Coupons
- Payment methods
- Paymob integration
- User administration
- Subscription administration
- Notifications
- Role-aware navigation

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 18 |
| Build | Vite 7 |
| UI | HeroUI |
| Styling | Tailwind CSS 4 |
| Routing | React Router |
| Charts | Recharts |
| HTTP | Axios |
| Backend | Django 5.2 |
| REST API | Django REST Framework |
| Database | MongoDB / PyMongo |
| Authentication | HttpOnly JWT session cookies |
| OAuth | Google Sign-In |
| Production frontend | Vercel |
| Production backend | Railway |
| Media | Cloudinary |
| Payments | Paymob |
| Production server | Gunicorn |

---

## Project Structure

```text
Revnivo/
├── api/
│   └── proxy.mjs
├── backend/
│   ├── api/
│   │   ├── applications.py
│   │   ├── application_workspace.py
│   │   ├── authentication.py
│   │   ├── jobs.py
│   │   ├── resumes.py
│   │   ├── serializers.py
│   │   ├── urls.py
│   │   └── views.py
│   ├── incomeflow/
│   ├── manage.py
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── api/
│   │   └── proxy.mjs
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── contexts/
│   │   ├── pages/
│   │   ├── services/
│   │   └── utils/
│   ├── package.json
│   ├── vite.config.js
│   └── .env.example
├── .github/
│   └── workflows/
│       └── security.yml
├── docker-compose.yml
└── README.md
```

---

## Local Development

### Requirements

- Python 3.10+
- Node.js 20+
- npm
- MongoDB locally or MongoDB Atlas
- Git

### Clone

```bash
git clone https://github.com/Shehab1001/Revnivo.git
cd Revnivo
```

### Backend

```bash
cd backend
python -m venv .venv
```

Windows:

```bat
.venv\Scripts\activate
```

macOS / Linux:

```bash
source .venv/bin/activate
```

Install dependencies:

```bash
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

Create the environment file:

```bash
cp .env.example .env
```

On Windows:

```bat
copy .env.example .env
```

Start Django:

```bash
python manage.py runserver 127.0.0.1:8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Local frontend:

```text
http://127.0.0.1:5173
```

Local API:

```text
http://127.0.0.1:8000/api
```

Vite proxies local `/api` traffic to Django.

---

## Production Deployment

### Vercel

The frontend is deployed on Vercel from the GitHub repository.

Required frontend environment variable:

```env
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
```

Keep `VITE_API_URL` blank when using the same-origin proxy.

The production frontend routes browser API requests through the Vercel API proxy before forwarding them to Railway. This keeps authentication traffic same-origin from the browser's perspective.

### Railway

Recommended production values include:

```env
DJANGO_DEBUG=false
FRONTEND_ORIGIN=https://revnivo.vercel.app
CORS_ALLOWED_ORIGINS=https://revnivo.vercel.app
CSRF_TRUSTED_ORIGINS=https://revnivo.vercel.app
AUTH_COOKIE_SECURE=true
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
PAYMOB_REDIRECT_URL=https://revnivo.vercel.app/payments?provider=paymob
```

Keep MongoDB, Cloudinary, JWT/Django secrets, SMTP credentials, and payment credentials in deployment environment variables. Never commit real secrets.

### Google Sign-In

Google Cloud should include:

```text
https://revnivo.vercel.app
```

as an Authorized JavaScript Origin.

Use the same Google OAuth client ID in:

- Vercel: `VITE_GOOGLE_CLIENT_ID`
- Railway: `GOOGLE_CLIENT_ID`

---

## Environment Variables

### Backend

Important variables are documented in `backend/.env.example`.

| Variable | Purpose |
| --- | --- |
| `DJANGO_SECRET_KEY` | Django cryptographic secret |
| `JWT_SECRET_KEY` | JWT signing key |
| `MONGODB_URI` | MongoDB connection |
| `MONGODB_DB` | Database name |
| `GOOGLE_CLIENT_ID` | Google authentication |
| `SUPERADMIN_EMAIL` | Superadmin account |
| `CLOUDINARY_URL` | Cloudinary configuration |
| `MICRO1_API_KEY` | Optional micro1 job integration |
| `EMAIL_HOST_*` | SMTP settings |
| `PAYMOB_*` | Paymob settings |
| `FRONTEND_ORIGIN` | Frontend origin |
| `CORS_ALLOWED_ORIGINS` | CORS origins |
| `CSRF_TRUSTED_ORIGINS` | CSRF trusted origins |

### Frontend

`frontend/.env.example` documents:

```env
VITE_API_URL=
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
```

---

## Main API Areas

```text
/api/auth/*
/api/dashboard/
/api/platforms/
/api/earnings/
/api/goals/
/api/jobs/
/api/applications/*
/api/resumes/*
/api/cover-letters/*
/api/notes/*
/api/support-chat/
/api/payments/*
/api/admin/*
```

---

## Security

Current protections include:

- HttpOnly session cookies
- CSRF protection
- CORS controls
- Secure-cookie support
- API throttling
- Role-aware backend authorization
- Private attachment/document delivery
- Cloudinary support
- Production Django security settings
- GitHub Actions security workflow
- `npm audit`
- `pip-audit`
- Django deployment checks

---

## Testing & Validation

Before promoting a production change, verify:

- Register
- Email/password login
- Google Sign-In
- Logout
- Session persistence after refresh
- Dashboard
- Dashboard customization
- Add/edit/delete income
- Platform management
- CSV import/export
- Jobs
- Application Tracker
- Resume import
- ATS analysis
- Notes and attachments
- Support Chat
- Password reset
- Payments when enabled

Frontend build:

```bash
cd frontend
npm run build
```

Backend checks:

```bash
cd backend
python manage.py check
```

---

## Notes

- `main` is the current production branch.
- Local development uses the Vite proxy to Django.
- Production uses Vercel for the frontend and Railway for the backend.
- Public job sources can change without notice.
- Image-only scanned resumes are not OCR'd automatically.
- ATS and job-match scores are heuristic tools, not hiring guarantees.

---

## Repository

GitHub:

```text
https://github.com/Shehab1001/Revnivo
```
