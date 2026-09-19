@echo off
setlocal
set "ROOT=%~dp0"

echo Starting IncomeFlow backend and frontend...
start "IncomeFlow Backend" /D "%ROOT%backend" cmd /k run.bat
timeout /t 2 /nobreak >nul
start "IncomeFlow Frontend" /D "%ROOT%frontend" cmd /k run.bat
timeout /t 4 /nobreak >nul
start "" http://localhost:5173
