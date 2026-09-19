@echo off
setlocal EnableExtensions
cd /d "%~dp0"

if exist ".venv\Scripts\python.exe" goto run

set "PYTHON_CMD="
for /f "delims=" %%I in ('where python.exe 2^>nul') do (
  if not defined PYTHON_CMD (
    "%%I" -c "import sys; raise SystemExit(0 if sys.version_info >= (3,10) else 1)" >nul 2>nul
    if not errorlevel 1 set "PYTHON_CMD=%%I"
  )
)

for %%V in (314 313 312 311 310) do (
  if not defined PYTHON_CMD if exist "%LocalAppData%\Programs\Python\Python%%V\python.exe" (
    "%LocalAppData%\Programs\Python\Python%%V\python.exe" -c "import sys; raise SystemExit(0 if sys.version_info >= (3,10) else 1)" >nul 2>nul
    if not errorlevel 1 set "PYTHON_CMD=%LocalAppData%\Programs\Python\Python%%V\python.exe"
  )
)

if not defined PYTHON_CMD (
  echo [ERROR] A working Python 3.10+ installation was not found.
  echo Install Python 3.12 or 3.13 and enable "Add python.exe to PATH".
  echo This script intentionally does not use the Windows "py" launcher.
  pause
  exit /b 1
)

echo Using Python: %PYTHON_CMD%
"%PYTHON_CMD%" -m venv .venv
if errorlevel 1 goto fail
".venv\Scripts\python.exe" -m pip install --upgrade pip
".venv\Scripts\python.exe" -m pip install -r requirements.txt
if errorlevel 1 goto fail

:run
".venv\Scripts\python.exe" manage.py initmongo
if errorlevel 1 (
  echo.
  echo [ERROR] Django is ready, but MongoDB is not reachable.
  echo Start MongoDB locally, use run_with_docker_mongo.bat, or put an Atlas URI in backend\.env.
  pause
  exit /b 1
)
".venv\Scripts\python.exe" manage.py runserver 127.0.0.1:8000
exit /b 0

:fail
echo [ERROR] Backend setup failed.
pause
exit /b 1
