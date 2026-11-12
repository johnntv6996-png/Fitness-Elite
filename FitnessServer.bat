@echo off
chcp 65001 >nul
title FITNESS ELITE - local server
cd /d "%~dp0my-fitness-app"

echo ============================================
echo   FITNESS ELITE - local server
echo   Folder: %CD%
echo   URL:    http://localhost:8080/?src=local
echo ============================================
echo.
echo Starting server... Keep this window open.
echo.

REM Запускаем сервер в фоне и ждём, пока он реально начнёт слушать порт
start "fitness-server" /min python -m http.server 8080

REM Ждём до 10 секунд, пока порт 8080 откроется
set /a tries=0
:wait
set /a tries+=1
powershell -NoProfile -Command "try { $c = New-Object Net.Sockets.TcpClient; $c.Connect('127.0.0.1', 8080); $c.Close(); exit 0 } catch { exit 1 }" >nul 2>&1
if %errorlevel%==0 goto ready
if %tries% geq 20 goto timeout
timeout /t 1 /nobreak >nul
goto wait

:ready
echo Server is up. Opening browser...
start "" http://localhost:8080/?src=local
echo.
echo Server running in background window "fitness-server".
echo Close that window to stop the server.
pause
exit /b 0

:timeout
echo ERROR: server did not start in 10 seconds.
echo Check if port 8080 is already in use: netstat -ano ^| findstr :8080
pause
exit /b 1