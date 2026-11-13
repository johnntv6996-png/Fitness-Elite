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

start "" http://localhost:8080/?src=local
python -m http.server 8080

echo.
echo Server stopped.
pause