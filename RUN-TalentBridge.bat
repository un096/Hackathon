@echo off
setlocal
title TalentBridge AI - setup and run
cd /d "%~dp0"
echo ================================================================
echo   TalentBridge AI - one-click setup and run
echo ================================================================

where node >nul 2>nul || (echo [X] Node.js not found. Install Node 22 LTS from https://nodejs.org and run again. & pause & exit /b 1)
for /f "delims=" %%v in ('node -v') do echo [ok] Node %%v
set "PY="
where python >nul 2>nul && set "PY=python"
if not defined PY where py >nul 2>nul && set "PY=py -3"
if defined PY (echo [ok] Python found) else (echo [!] Python not found - AI service will be skipped; the app uses its built-in fallbacks.)

if not exist backend\.env (copy backend\.env.example backend\.env >nul & echo [!] Created backend\.env - set DATABASE_URL to your PostgreSQL user/password, then run again. & notepad backend\.env & pause & exit /b 1)

echo.
echo [1/6] Installing backend packages...
pushd backend
if not exist node_modules\@prisma\client call npm install --no-audit --no-fund || goto :fail
call npx prisma generate || goto :fail
echo.
echo [2/6] Preparing the database...
call node scripts\db-init.js
if errorlevel 1 goto :fail
call npx prisma migrate deploy || goto :fail
popd

echo.
echo [3/6] Starting the AI service...
if defined PY (
  pushd ai-service
  if not exist .venv\Scripts\python.exe (
    echo      creating Python virtual environment and installing requirements - first run takes a few minutes...
    %PY% -m venv .venv || goto :nopy
    .venv\Scripts\python -m pip install --disable-pip-version-check -q -r requirements.txt || goto :nopy
  )
  start "TalentBridge AI service :8000" cmd /k ".venv\Scripts\python run.py"
  popd
)
goto :afterpy
:nopy
popd
echo [!] AI service setup failed - continuing with built-in fallbacks.
:afterpy

echo.
echo [4/6] Seeding demo data...
pushd backend
if defined PY call node scripts\wait-for.js http://127.0.0.1:8000/health 90
call node prisma\seed.js || goto :fail
start "TalentBridge API :5000" cmd /k "npm run dev"
popd

echo.
echo [5/6] Installing and starting the web app...
pushd frontend
if not exist node_modules\vite call npm install --no-audit --no-fund || goto :fail
start "TalentBridge Web :5173" cmd /k "npm run dev"
popd

echo.
echo [6/6] Opening the browser...
call node backend\scripts\wait-for.js http://localhost:5173 90
start "" http://localhost:5173/login
echo.
echo ================================================================
echo   Running.  Web http://localhost:5173   API http://localhost:5000/api/health
echo   Logins (password Demo@1234): hr@ / manager@ / employee@talentbridge.demo
echo   Close the three service windows to stop.
echo ================================================================
pause
exit /b 0

:fail
popd 2>nul
echo.
echo [X] Setup stopped - see the message above.
pause
exit /b 1
