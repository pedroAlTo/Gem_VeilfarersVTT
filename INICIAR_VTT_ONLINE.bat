@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Instala Node.js LTS desde https://nodejs.org/, luego ejecuta este archivo.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] No se encuentra npm en el sistema.
  pause
  exit /b 1
)

node scripts\local-setup.mjs
if errorlevel 1 (
  pause
  exit /b 1
)

set "VITE_LOCAL_ONLY=0"
set "VITE_SESSION_TRANSPORT=peerjs"
node scripts\lan-info.mjs
set "LAN_IP="
for /f "delims=" %%i in ('node scripts\lan-info.mjs --primary') do set "LAN_IP=%%i"
set "LAN_OPEN="
if defined LAN_IP set "LAN_OPEN=--open http://%LAN_IP%:5173/"
echo Mantén esta ventana abierta mientras juegues. Pulsa Ctrl+C para detener el servidor.
call npm run dev -- --host 0.0.0.0 --port 5173 --strictPort %LAN_OPEN%
if errorlevel 1 (
  echo Si el puerto 5173 está ocupado, detén la sesión anterior y reintenta.
  pause
  exit /b 1
)
endlocal
