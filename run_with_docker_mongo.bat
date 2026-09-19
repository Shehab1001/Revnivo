@echo off
setlocal
cd /d "%~dp0"
where docker >nul 2>nul || (
  echo [ERROR] Docker was not found. Install Docker Desktop, or use MongoDB Atlas and run run.bat instead.
  pause
  exit /b 1
)
docker compose up -d mongo
if errorlevel 1 (
  echo [ERROR] Could not start MongoDB container.
  pause
  exit /b 1
)
echo Waiting briefly for MongoDB to accept connections...
timeout /t 4 /nobreak >nul
call run.bat
