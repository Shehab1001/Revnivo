<div align="center">

<img src="frontend/public/logo.svg" alt="Revnivo" width="220" />

# Revnivo

**A full-stack workspace for income tracking, AI job discovery, application management, and career tools.**

[![Security checks](https://github.com/Shehab1001/Revnivo/actions/workflows/security.yml/badge.svg?branch=V1.1)](https://github.com/Shehab1001/Revnivo/actions/workflows/security.yml)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![Django](https://img.shields.io/badge/Django-5.2-092E20?logo=django&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-PyMongo-47A248?logo=mongodb&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white)

</div>

> **Active development branch:** `V1.1`  
> The default `main` branch is kept as the stable branch. The feature set described below reflects the current `V1.1` development branch.

---

## Overview

Revnivo is a full-stack productivity platform that combines personal revenue tracking with a career workflow for people working across online platforms, freelance marketplaces, AI-training platforms, and remote opportunities.

The project started as an income dashboard and has grown into a broader workspace with earnings analytics, platform management, job aggregation, application tracking, resume tooling, private notes, support chat, subscriptions, and administrative controls.

## Highlights

### Income & Platform Management

- Multi-platform earnings tracking
- Dashboard cards and configurable layouts
- MTD / YTD style reporting and period filters
- Currency-aware earnings views
- Platform status management
- Material price / revenue-style trend visualizations
- CSV import and export support
- Income goals and dashboard preferences

### Jobs Hub

The Jobs workspace combines public opportunities from multiple AI-training, expert, and remote-work platforms.

Current integrations include sources such as:

- AlignList
- Alignerr
- Mercor
- Turing
- micro1
- Outlier
- AfterQuery Experts
- AfterQuery Careers
- DataAnnotation
- Mindrift
- CrowdGen by Appen
- TELUS Digital AI
- Stellar AI
- OneForma
- Prolific
- LXT

The Jobs UI includes:

- Search
- Platform filtering
- Category filtering
- Remote-only filtering
- Sorting
- Pagination
- Source status indicators
- Platform logos
- Progressive background refresh
- Direct tracking of a job into the Application Tracker

> Job availability and counts are dynamic because Revnivo reads public listings from external sources. A source may temporarily expose fewer listings, require authentication, or change its public interface.

### Application Tracker

Applications are managed as a career CRM directly under the Jobs workspace.

Pipeline stages:

```text
Saved → Applied → Screening → Interview → Offer → Rejected
```

Features include:

- Kanban board
- Drag-and-drop stage changes
- Application priority
- Recruiter details
- Salary / rate tracking
- Deadlines
- Interview dates
- Tags and notes
- Archive and restore workflows
- Activity timeline
- Application-level tasks
- Follow-up reminders
- Interview rounds
- Private application documents
- Career analytics
- Upcoming agenda
- Response and offer metrics

### Resume Studio

Resume Studio is built into the Jobs section and supports multiple career documents per user.

#### Resume Builder

- Multiple resumes
- Modern, Classic, Compact, and Minimal layouts
- Contact and headline editor
- Professional summary
- Experience
- Education
- Skills
- Projects
- Certifications
- Languages
- Section ordering
- Live preview
- Browser Print / Save as PDF
- Resume duplication
- Version snapshots
- Version restore

#### CV Import

Existing CVs can be imported from:

- PDF
- DOCX
- TXT

Revnivo extracts text and attempts to convert recognized sections into editable Resume Studio fields.

Text-based PDFs are supported. Scanned image-only PDFs currently need to be converted to a text-based PDF or DOCX first.

#### ATS Readiness & Job Match

Resume Studio includes two separate analyses:

**ATS Readiness** checks general resume structure and content completeness, including contact information, summary, skills, experience, education, parseability, and measurable results.

**Job-specific ATS Match** compares the selected resume with a supplied job description and reports:

- Match percentage
- Keyword coverage
- Multi-word phrase coverage
- Missing keywords
- Missing phrases
- Resume completeness
- Improvement recommendations

These scores are heuristic analysis tools. They are **not** predictions of an employer's ATS score, interview decision, or hiring outcome.

#### Smart Job Recommendations

A resume can also be compared against the jobs currently loaded in Revnivo.

The matching engine uses resume/job keyword and skill overlap to surface potentially relevant roles and displays:

- Relevance score
- Matching skills
- Matching keywords
- Company / platform
- Compensation when available
- Location
- Original job link

### Notes

- Notion-style personal notes
- Rich content workflow
- Search
- Attachments
- Image and document support
- Private attachment storage
- RTL-friendly content

### Support Chat

- User ↔ support conversations
- Admin ↔ admin direct messages
- Private per-admin conversations
- Image attachments
- Voice recording
- Online presence
- Last-message previews
- Delete-for-me / delete-for-everyone behavior
- Real user avatars for staff-to-staff conversations
- Branded Revnivo Support identity for end users

### Payments & Administration

- Subscription plans
- Coupons
- Payment methods
- Paymob Unified Checkout integration
- Admin user management
- Subscription administration
- Notification system
- Role-aware navigation

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 18 |
| Build Tool | Vite 7 |
| UI | HeroUI |
| Styling | Tailwind CSS 4 |
| Routing | React Router |
| Charts | Recharts |
| Icons | Lucide React |
| HTTP Client | Axios |
| Backend | Django 5.2 |
| REST API | Django REST Framework |
| Database | MongoDB via PyMongo |
| Authentication | JWT session cookie |
| OAuth | Google Sign-In |
| Media | Cloudinary / local private media |
| PDF Parsing | pypdf |
| DOCX Parsing | python-docx |
| HTML Parsing | Beautiful Soup |
| Payments | Paymob |
| Production Server | Gunicorn |

---

## Project Structure

```text
Revnivo/
├── backend/
│   ├── api/
│   │   ├── applications.py
│   │   ├── application_workspace.py
│   │   ├── jobs.py
│   │   ├── resumes.py
│   │   ├── views.py
│   │   └── urls.py
│   ├── backend/
│   ├── manage.py
│   ├── requirements.txt
│   └── .env.example
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── contexts/
│   │   ├── pages/
│   │   ├── services/
│   │   └── utils/
│   ├── package.json
│   └── .env.example
│
└── .github/
    └── workflows/
        └── security.yml
```

---

## Local Development

### Prerequisites

Install:

- Python 3.11+ recommended
- Node.js 20+
- npm
- MongoDB locally **or** a MongoDB Atlas connection string
- Git

Cloudinary is optional for local development. When it is not configured, Revnivo can use local media storage.

### 1. Clone the repository

```bash
git clone https://github.com/Shehab1001/Revnivo.git
cd Revnivo
git checkout V1.1
```

### 2. Backend setup

```bash
cd backend
python -m venv .venv
```

Activate the virtual environment.

**Windows**

```bat
.venv\Scripts\activate
```

**macOS / Linux**

```bash
source .venv/bin/activate
```

Install dependencies:

```bash
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

Create the environment file:

**Windows**

```bat
copy .env.example .env
```

**macOS / Linux**

```bash
cp .env.example .env
```

At minimum, configure MongoDB and replace the example secrets in `.env`.

Start Django:

```bash
python manage.py runserver 127.0.0.1:8000
```

### 3. Frontend setup

Open another terminal:

```bash
cd frontend
npm install
```

Create the frontend environment file:

**Windows**

```bat
copy .env.example .env
```

**macOS / Linux**

```bash
cp .env.example .env
```

Start Vite:

```bash
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

The frontend development server proxies `/api` requests to the local Django backend.

---

## Environment Configuration

### Backend

Important variables are documented in `backend/.env.example`.

| Variable | Purpose |
| --- | --- |
| `DJANGO_SECRET_KEY` | Django cryptographic secret |
| `JWT_SECRET_KEY` | JWT signing secret |
| `MONGODB_URI` | MongoDB / Atlas connection |
| `MONGODB_DB` | Database name |
| `GOOGLE_CLIENT_ID` | Google authentication |
| `SUPERADMIN_EMAIL` | Explicit superadmin account |
| `CLOUDINARY_URL` | Cloudinary media configuration |
| `CLOUDINARY_FOLDER` | Cloudinary root folder |
| `MICRO1_API_KEY` | Optional expanded micro1 job sync |
| `EMAIL_HOST_*` | SMTP configuration |
| `PAYMOB_*` | Paymob payment configuration |
| `FRONTEND_ORIGIN` | Trusted frontend origin |
| `CSRF_TRUSTED_ORIGINS` | CSRF trusted origins |
| `CORS_ALLOWED_ORIGINS` | Allowed CORS origins |

Never commit real credentials or API secrets.

### Frontend

`frontend/.env.example` contains:

```env
VITE_API_URL=
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
```

For local development, leaving `VITE_API_URL` empty uses the Vite `/api` proxy.

---

## Main API Areas

The backend exposes REST endpoints for the major product areas, including:

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

Resume and application-specific endpoints also cover versions, ATS analysis, job matching, tasks, interviews, documents, analytics, and materials linking.

---

## Security

The project includes a GitHub Actions security workflow covering both frontend and backend.

Current CI checks include:

- `npm audit --audit-level=high`
- Production frontend build
- Python dependency installation
- `pip-audit`
- Django `check --deploy`

Additional application protections include:

- HttpOnly authentication cookies
- Configurable Secure and SameSite cookie behavior
- CSRF / CORS configuration
- API throttling
- Private document and attachment delivery
- Cloudinary authenticated assets for protected files
- Role-aware backend authorization
- Production-only security settings via environment variables

---

## Media Storage

Local development can use:

```text
backend/media/
backend/private_media/
```

Cloudinary can be enabled through `CLOUDINARY_URL`.

Revnivo separates public assets from authenticated/private uploads. Application documents, notes attachments, and protected chat media use private delivery paths.

---

## Development Notes

- The active development branch is `V1.1`.
- The frontend is currently configured for localhost API development through the Vite proxy.
- Public job integrations can change when third-party websites update their HTML, public APIs, or access policies.
- Resume import intentionally avoids OCR. Image-only scanned PDFs should be converted to a text-based document before import.
- Generated ATS/relevance scores are decision-support signals only and should not be treated as employer-side scores.

---

## Roadmap

Areas planned or suitable for continued development include:

- More robust CV parsing
- Additional resume templates
- Enhanced job-detail extraction
- Application reminder notifications
- Calendar integrations
- More career analytics
- Expanded job-source adapters
- Production deployment automation

---

## Repository

**Revnivo** is under active development.

For the newest implementation, use:

```bash
git checkout V1.1
```

