@echo off
setlocal
cd /d "%~dp0payload\site"
where python >nul 2>&1
if errorlevel 1 (
  echo Python not found. Use 01_OPEN_LIVE_APP.bat after GitHub deployment.
  pause
  exit /b 1
)
start "" "http://localhost:8787"
python -m http.server 8787
