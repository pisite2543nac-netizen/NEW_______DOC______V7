@echo off
setlocal EnableExtensions
chcp 65001 >nul
title DOC-FULL-NR V7 FINAL - ONE CLICK FINISH

set "REPO=https://github.com/pisite2543nac-netizen/NEW_______DOC______V7.git"
set "WORK=%~dp0_work_repo"
set "PAYLOAD=%~dp0payload"

echo ============================================================
echo  DOC-FULL-NR V7 FINAL - ZERO BUILD PRODUCTION DEPLOY
echo ============================================================
echo.
echo Repo: %REPO%
echo This deploy does NOT use TypeScript, npm, Vite, or Firebase.
echo Existing React source is kept as backup. Only /site and Pages workflow are replaced.
echo.

where git >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Git is not installed or not in PATH.
  goto :fail
)

if not exist "%PAYLOAD%\site\index.html" (
  echo [ERROR] payload\site\index.html not found.
  goto :fail
)

echo [1/6] Preparing repository...
if exist "%WORK%\.git" (
  cd /d "%WORK%"
  git fetch origin
  if errorlevel 1 goto :fail
  git checkout main
  if errorlevel 1 goto :fail
  git pull --ff-only origin main
  if errorlevel 1 goto :fail
) else (
  if exist "%WORK%" rmdir /s /q "%WORK%"
  git clone "%REPO%" "%WORK%"
  if errorlevel 1 goto :fail
  cd /d "%WORK%"
  git checkout main
  if errorlevel 1 goto :fail
)

echo [2/6] Installing final static PWA...
if not exist "%WORK%\site" mkdir "%WORK%\site"
robocopy "%PAYLOAD%\site" "%WORK%\site" /MIR /R:1 /W:1 /NFL /NDL /NJH /NJS /NP >nul
set "RC=%ERRORLEVEL%"
if %RC% GEQ 8 (
  echo [ERROR] Copy site failed. Robocopy code %RC%
  goto :fail
)

echo [3/6] Installing ZERO-BUILD GitHub Pages workflow...
if not exist "%WORK%\.github\workflows" mkdir "%WORK%\.github\workflows"
copy /Y "%PAYLOAD%\.github\workflows\deploy-pages.yml" "%WORK%\.github\workflows\deploy-pages.yml" >nul
if errorlevel 1 goto :fail

echo [4/6] Committing...
git add site .github/workflows/deploy-pages.yml
git diff --cached --quiet
if errorlevel 1 (
  git commit -m "Deploy DOC-FULL-NR V7 FINAL zero-build production"
  if errorlevel 1 goto :fail
) else (
  echo No content changes detected. Creating a deploy trigger commit...
  git commit --allow-empty -m "Redeploy DOC-FULL-NR V7 FINAL"
  if errorlevel 1 goto :fail
)

echo [5/6] Pushing to GitHub main...
git push origin main
if errorlevel 1 goto :fail

echo [6/6] Done. Opening GitHub Actions...
start "" "https://github.com/pisite2543nac-netizen/NEW_______DOC______V7/actions"

echo.
echo ============================================================
echo SUCCESS: V7 FINAL source was pushed.
echo GitHub Actions now deploys /site directly - NO BUILD STEP.
echo ============================================================
echo.
echo The live app will be:
echo https://pisite2543nac-netizen.github.io/NEW_______DOC______V7/
echo.
echo Waiting 35 seconds, then opening the live app...
timeout /t 35 /nobreak >nul
start "" "https://pisite2543nac-netizen.github.io/NEW_______DOC______V7/?final=1"
echo.
echo If Actions is still running, wait until Deploy DOC-FULL-NR FINAL is green.
pause
exit /b 0

:fail
echo.
echo ============================================================
echo [ERROR] Deployment stopped safely.
echo No force push was used. Existing Supabase data was not deleted.
echo ============================================================
pause
exit /b 1
