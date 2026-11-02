@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js LTS, then run this file again.
  pause
  exit /b 1
)
node scripts/local-setup.mjs
if errorlevel 1 (
  pause
  exit /b 1
)
set "VITE_LOCAL_ONLY=0"
echo Online mode. Firebase requires .env.local - see FIREBASE_SETUP.md.
echo Open the Local URL printed below. Press Ctrl+C to stop.
call npm run dev -- --host 127.0.0.1
pause
