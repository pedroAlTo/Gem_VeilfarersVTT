@echo off
setlocal
chcp 65001 >nul
title VeilFarers - Orbital local tests
pushd "%~dp0"
if errorlevel 1 exit /b 1
where node >nul 2>&1
if errorlevel 1 goto missing_node
where npm >nul 2>&1
if errorlevel 1 goto missing_node
if not exist package.json goto missing_files
node scripts\local-setup.mjs
if errorlevel 1 goto failed
set "VITE_LOCAL_ONLY=1"
echo.
echo   VEILFARERS / ORBITAL II
echo   Local tests - no multiplayer or Firebase
echo.
echo   [1] Tests + build + open VTT (recommended)
echo   [2] Open VTT directly
echo   [3] Tests + build only
echo   [4] Open visual effects lab
echo   [5] Exit
choice /c 12345 /n /m "Select 1-5: "
if errorlevel 5 goto done
if errorlevel 4 goto effects_lab
if errorlevel 3 goto tests_only
if errorlevel 2 goto start_vtt
call :checks
if errorlevel 1 goto failed
goto start_vtt
:tests_only
call :checks
if errorlevel 1 goto failed
echo All checks passed.
pause
goto done
:checks
call npm test
if errorlevel 1 exit /b 1
call npm run build
if errorlevel 1 exit /b 1
exit /b 0
:start_vtt
echo.
echo Opening http://127.0.0.1:5173/
echo Keep this window open. Press Ctrl+C to stop the server.
echo Campaigns stay in this browser. Use Archive to export a backup.
call npm run dev -- --host 127.0.0.1 --port 5173 --strictPort --open
if errorlevel 1 goto failed
goto done
:effects_lab
call npm run dev -- --host 127.0.0.1 --port 5173 --strictPort --open /fx-lab.html
if errorlevel 1 goto failed
goto done
:missing_node
echo Install Node.js 24 LTS from https://nodejs.org/ and reopen this batch.
goto failed
:missing_files
echo Extract the complete ZIP before running this batch.
echo INICIAR_VTT_LOCAL.bat must be next to package.json.
goto failed
:failed
echo.
echo Could not complete the operation. Read the error above.
echo If port 5173 is busy, stop the previous VTT window and retry.
pause
popd
exit /b 1
:done
popd
endlocal
exit /b 0
