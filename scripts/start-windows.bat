@echo off
REM TalentBridge AI - Windows All-in-One Startup Script
echo Starting TalentBridge AI...

REM Check if PostgreSQL is accepting connections
"C:\Program Files\PostgreSQL\18\bin\pg_isready.exe" -h 127.0.0.1 >nul 2>&1
if %errorlevel% neq 0 (
    echo Starting PostgreSQL 18...
    start "PostgreSQL Server" "C:\Program Files\PostgreSQL\18\bin\postgres.exe" -D "C:\Program Files\PostgreSQL\18\data"
    timeout /t 3 >nul
) else (
    echo PostgreSQL is already running.
)

REM Start Backend and Frontend in separate console windows
start "TalentBridge API (Port 5000)" cmd /k "cd /d "%~dp0..\backend" && npm run dev"
start "TalentBridge Web (Port 5173)" cmd /k "cd /d "%~dp0..\frontend" && npm run dev"

echo.
echo ====================================================
echo  TalentBridge AI is launching!
echo  Open http://localhost:5173 once both windows load.
echo ====================================================
