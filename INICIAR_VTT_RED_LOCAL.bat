@echo off
setlocal
chcp 65001 >nul
title VeilFarers VTT - Red Local / Multijugador
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Se necesita Node.js 22.12+ o 24 LTS instalado.
  echo Descárgalo de https://nodejs.org/
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] No se encuentra npm en el sistema.
  pause
  exit /b 1
)

if not exist package.json (
  echo [ERROR] package.json no encontrado en este directorio.
  echo Asegúrate de ejecutar este archivo desde la carpeta extraída.
  pause
  exit /b 1
)

node scripts\local-setup.mjs
if errorlevel 1 (
  echo [ERROR] Falló la preparación de dependencias locales.
  pause
  exit /b 1
)

REM Activar multijugador (desactivar modo solo local)
set "VITE_LOCAL_ONLY=0"
set "VITE_SESSION_TRANSPORT=lan"

REM Mostrar información de la red local
node scripts\lan-info.mjs
set "LAN_IP="
for /f "delims=" %%i in ('node scripts\lan-info.mjs --primary') do set "LAN_IP=%%i"
set "LAN_OPEN="
if defined LAN_IP set "LAN_OPEN=--open http://%LAN_IP%:5173/"
echo Mantén esta ventana abierta mientras juegues. Pulsa Ctrl+C para detener el servidor.
call npm run dev -- --host 0.0.0.0 --port 5173 --strictPort %LAN_OPEN%
if errorlevel 1 (
  echo.
  echo [AVISO] Si el puerto 5173 está ocupado, cierra cualquier otra sesión del VTT y reintenta.
  pause
  exit /b 1
)
endlocal
