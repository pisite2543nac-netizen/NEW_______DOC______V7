@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0.."
echo ====================================================
echo DOC-FULL-NR V7 - PUSH TO NEW GITHUB REPOSITORY
echo ====================================================
where git >nul 2>&1 || (echo [ERROR] Git not found & pause & exit /b 1)
if not exist .git git init
set /p REPO_URL=Paste NEW GitHub repository URL (example https://github.com/USER/doc-full-nr-universal.git): 
if "%REPO_URL%"=="" (echo [ERROR] URL required & pause & exit /b 1)
git add .
git commit -m "Initial DOC-FULL-NR V7 Universal production" 2>nul || echo Nothing new to commit.
git branch -M main
git remote remove origin >nul 2>&1
git remote add origin "%REPO_URL%"
git push -u origin main
if errorlevel 1 (echo [ERROR] Push failed. Check GitHub login/URL. & pause & exit /b 1)
echo.
echo [SUCCESS] Source pushed to GitHub.
echo Next: GitHub repo Settings ^> Pages ^> Source = GitHub Actions
echo Then Actions ^> Deploy DOC-FULL-NR Universal.
pause
