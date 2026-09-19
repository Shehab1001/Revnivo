@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul || (
  echo [ERROR] Node.js was not found. Install Node.js 20.19+ or 22.12+ and run again.
  pause
  exit /b 1
)
if not exist node_modules (
  call npm install
  if errorlevel 1 (
    echo [ERROR] npm install failed.
    pause
    exit /b 1
  )
)
call npm run dev
