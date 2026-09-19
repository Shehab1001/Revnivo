# IncomeFlow — React + Tailwind + Django REST + MongoDB

A full-stack income dashboard for tracking earnings from multiple platforms over months and years.

## Stack

- Frontend: React 18, Vite, Tailwind CSS 4, React Router, Recharts, Axios
- Backend: Python, Django 5.2, Django REST Framework
- Database: MongoDB through the official PyMongo driver
- Authentication: JWT Bearer tokens + Django password hashing
- Money storage: MongoDB Decimal128
- Platform images: Django media storage in development

## Features

- Register / login
- Private user-scoped data
- Light / dark mode
- Add, edit, and archive income platforms without erasing historical earnings
- Upload a platform logo/image
- Add, edit, delete, and search earnings
- Store date, amount, currency, category, and notes
- Monthly income chart
- Lifetime yearly income chart
- Income-by-platform chart
- Dashboard filters for year and currency
- Recent earnings and summary cards
- Responsive desktop/mobile UI

## Project structure

```text
incomeflow_react_django_mongo/
  backend/        Django REST API + PyMongo
  frontend/       React + Tailwind + Vite
  docker-compose.yml
  run.bat
  run_with_docker_mongo.bat
```

## Prerequisites

1. Python 3.10+ (Python 3.12 or 3.13 recommended)
2. Node.js 20.19+ or 22.12+
3. MongoDB, either:
   - local MongoDB on `mongodb://127.0.0.1:27017`, or
   - MongoDB Atlas connection string, or
   - Docker Desktop using the included compose file

## Fastest local setup on Windows with Docker Desktop

1. Extract the project.
2. Double-click `run_with_docker_mongo.bat`.
3. The script starts MongoDB, the Django API, and the Vite frontend.
4. Open `http://localhost:5173`.

On first run, Python and npm dependencies are installed automatically.

## Windows setup using MongoDB Atlas

1. Copy `backend/.env.example` to `backend/.env`.
2. Put your Atlas connection string in `MONGODB_URI`.
3. Change `JWT_SECRET_KEY` and `DJANGO_SECRET_KEY`.
4. Double-click `run.bat`.
5. Open `http://localhost:5173`.

Example:

```env
DJANGO_DEBUG=true
DJANGO_SECRET_KEY=replace-with-a-long-random-value
JWT_SECRET_KEY=replace-with-another-long-random-value
MONGODB_URI=mongodb+srv://USERNAME:PASSWORD@YOUR_CLUSTER.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB=incomeflow
EGP_PER_USD=50.00
EGP_RATE_API_URL=https://open.er-api.com/v6/latest/USD
EGP_RATE_CACHE_SECONDS=3600
FRONTEND_ORIGIN=http://localhost:5173
GOOGLE_CLIENT_ID=your-google-web-client-id.apps.googleusercontent.com
```

For Google sign-in, create a Web application OAuth client in Google Cloud Console. Add these exact Authorized JavaScript origins (without a path or trailing slash): `http://localhost:5173` and `http://127.0.0.1:5173`. Then set the same client ID as `GOOGLE_CLIENT_ID` in `backend/.env` and `VITE_GOOGLE_CLIENT_ID` in `frontend/.env`.

## Run manually

### Backend

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
python -m pip install -r requirements.txt
python manage.py initmongo
python manage.py runserver 127.0.0.1:8000
```

API health check: `http://127.0.0.1:8000/api/health/`

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend: `http://localhost:5173`

## API endpoints

```text
POST   /api/auth/register/
POST   /api/auth/login/
GET    /api/auth/me/
GET    /api/platforms/
POST   /api/platforms/
GET    /api/platforms/:id/
PATCH  /api/platforms/:id/
DELETE /api/platforms/:id/
GET    /api/earnings/
POST   /api/earnings/
GET    /api/earnings/:id/
PATCH  /api/earnings/:id/
DELETE /api/earnings/:id/
GET    /api/dashboard/?currency=USD&year=all
GET    /api/health/
```

## Important money behavior

Income in different currencies is intentionally not added together. Choose the currency in the dashboard filter. The EGP view converts USD entries using the live rate from `EGP_RATE_API_URL`, caches it for `EGP_RATE_CACHE_SECONDS`, and falls back to `EGP_PER_USD` if the API is unavailable.

## Production notes

Before production deployment:

- set `DJANGO_DEBUG=false`
- set strong Django/JWT secrets
- configure `ALLOWED_HOSTS`
- use HTTPS
- use MongoDB Atlas or another managed Mongo deployment
- move uploaded logos to object storage such as S3/Cloudinary instead of local media storage
- use a production WSGI/ASGI server and reverse proxy
- consider refresh tokens / token revocation for more advanced auth needs

## Python Launcher problem

The project does not rely on the Windows `py` launcher. `backend/run.bat` locates a working `python.exe` from PATH and creates a project-local `.venv`, avoiding the stale `Python314` launcher path issue from the previous build.
