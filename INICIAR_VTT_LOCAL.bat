@echo off
setlocal
chcp 65001 >nul
title VeilFarers - Orbital VTT Launcher
pushd "%~dp0"
if errorlevel 1 exit /b 1

where node >nul 2>&1
if errorlevel 1 goto missing_node
where npm >nul 2>&1
if errorlevel 1 goto missing_node
if not exist package.json goto missing_files

node scripts\local-setup.mjs
if errorlevel 1 goto failed

echo.
echo   ==============================================================
echo     VEILFARERS / ORBITAL VTT
echo   ==============================================================
echo.
echo   [1] Iniciar en RED LOCAL (Multijugador LAN / WiFi recomendado)
echo   [2] Iniciar SOLO EN ESTE PC (127.0.0.1 offline)
echo   [3] Tests + compilacion + abrir en Red Local
echo   [4] Tests + compilacion solamente
echo   [5] Laboratorio de efectos visuales (fx-lab)
echo   [6] Salir
echo.
choice /c 123456 /n /m "Selecciona una opcion (1-6): "
if errorlevel 6 goto done
if errorlevel 5 goto effects_lab
if errorlevel 4 goto tests_only
if errorlevel 3 goto checks_and_lan
if errorlevel 2 goto start_solo
if errorlevel 1 goto start_lan

:checks_and_lan
call :checks
if errorlevel 1 goto failed
goto start_lan

:tests_only
call :checks
if errorlevel 1 goto failed
echo Todos los tests pasaron exitosamente.
pause
goto done

:checks
call npm test
if errorlevel 1 exit /b 1
call npm run build
if errorlevel 1 exit /b 1
exit /b 0

:start_lan
set "VITE_LOCAL_ONLY=0"
node scripts\lan-info.mjs
set "LAN_IP="
for /f "delims=" %%i in ('node scripts\lan-info.mjs --primary') do set "LAN_IP=%%i"
set "LAN_OPEN="
if defined LAN_IP set "LAN_OPEN=--open http://%LAN_IP%:5173/"
echo Mantén esta ventana abierta mientras juegues. Pulsa Ctrl+C para detener el servidor.
call npm run dev -- --host 0.0.0.0 --port 5173 --strictPort %LAN_OPEN%
if errorlevel 1 goto failed
goto done

:start_solo
set "VITE_LOCAL_ONLY=1"
echo.
echo Modo offline en este ordenador (127.0.0.1)
echo Abriendo http://127.0.0.1:5173/ ...
echo Mantén esta ventana abierta. Pulsa Ctrl+C para detener el servidor.
call npm run dev -- --host 127.0.0.1 --port 5173 --strictPort --open
if errorlevel 1 goto failed
goto done

:effects_lab
set "VITE_LOCAL_ONLY=1"
call npm run dev -- --host 127.0.0.1 --port 5173 --strictPort --open /fx-lab.html
if errorlevel 1 goto failed
goto done

:missing_node
echo Instala Node.js 24 LTS o 22.12+ desde https://nodejs.org/ y vuelve a abrir este archivo.
goto failed

:missing_files
echo Extrae el ZIP completo antes de ejecutar este archivo.
echo INICIAR_VTT_LOCAL.bat debe estar junto a package.json.
goto failed

:failed
echo.
echo No se pudo completar la operacion. Revisa el mensaje de error superior.
echo Si el puerto 5173 esta ocupado, cierra la ventana previa del VTT y reintenta.
pause
popd
exit /b 1

:done
popd
endlocal
exit /b 0
