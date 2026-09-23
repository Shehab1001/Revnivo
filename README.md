# Revnivo

Revnivo is a full-stack personal income management platform for freelancers, creators, consultants, and other professionals who earn through multiple platforms or clients. It provides a centralized workspace for recording earnings, organizing income sources, monitoring performance, and maintaining a clear history of financial activity.

The application combines a responsive React dashboard with a Django REST API and MongoDB persistence. Users can manage platforms such as freelance marketplaces, content platforms, client portals, and direct income sources; record earnings in different currencies; review aggregated metrics and charts; and use supporting tools such as notes and support chat. Administrative users have dedicated views for managing users and subscriptions.

## Product capabilities

- User registration, login, Google sign-in, and JWT-protected sessions
- Private, user-scoped platforms, earnings, notes, notifications, and chat data
- Dashboard summaries with monthly, yearly, and platform-level income analysis
- Filtering by currency, date period, and platform
- Multi-currency earnings with USD conversion support and cached exchange rates
- Platform management with logos, websites, statuses, search, sorting, table pagination, and drag-and-drop ordering
- Earnings management with create, edit, delete, search, sorting, pagination, categories, notes, and dates
- Notes workspace with search and pagination
- In-app notifications and user-to-user/support chat with media attachments
- Administrator views for user management and subscription activation
- Responsive layouts with light and dark themes for desktop and mobile screens

## Technology stack

### Frontend

- React 18.3 for the component-based user interface
- Vite 7 for development, bundling, and production builds
- React Router 6 for client-side navigation and protected application routes
- HeroUI for accessible interface primitives such as cards, inputs, selects, chips, buttons, and pagination
- Tailwind CSS 4 for utility-first styling and responsive layouts
- Lucide React for interface icons
- Recharts for dashboard charts and data visualization
- Axios for API communication through the Vite development proxy
- Framer Motion for selected interface transitions
- Flag Icons for currency and country indicators

### Backend

- Python with Django 5.2 as the web framework
- Django REST Framework for HTTP APIs and serialization
- PyMongo for direct MongoDB access and document persistence
- PyJWT for stateless JWT authentication
- Django CORS Headers for controlled frontend/API communication
- Pillow for uploaded platform and profile images
- Google Auth for Google identity-token verification
- Requests and python-dotenv for external rate services and environment configuration

### Data and infrastructure

- MongoDB 8, accessed through PyMongo
- MongoDB Decimal128 for precise monetary storage
- Local Django media storage for uploaded images and chat media during development
- Docker Compose for an optional local MongoDB service
- Windows batch launchers for starting the backend, frontend, and Docker-backed development environment

## Architecture

The project is organized as two independently runnable applications:

- `frontend/`: React single-page application responsible for navigation, authentication state, themes, dashboard views, forms, tables, charts, and API calls.
- `backend/`: Django REST service responsible for authentication, authorization, business logic, MongoDB access, serialization, media handling, exchange-rate conversion, and administrative endpoints.
- `docker-compose.yml`: Optional MongoDB 8 service with a persistent Docker volume.

The frontend communicates with the backend through `/api` endpoints. In local development, Vite proxies API and media requests to Django on `127.0.0.1:8000`, while the frontend runs on `http://localhost:5173`.

## Project structure

```text
revnivo_react_django_mongo/
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
