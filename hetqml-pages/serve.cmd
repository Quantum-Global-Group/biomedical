@echo off
REM Serve this folder over http://localhost:8080. Required because Next.js bundle
REM URLs are absolute (/_next/...) and file:// can't resolve them.
REM Tries (in order): native Python on Windows, py launcher, then WSL + npx serve.

cd /d "%~dp0"

where python >nul 2>&1
if %errorlevel% equ 0 (
  echo Serving %~dp0 on http://localhost:8080  ^(Ctrl+C to stop^)
  python -m http.server 8080
  exit /b %errorlevel%
)

where py >nul 2>&1
if %errorlevel% equ 0 (
  echo Serving %~dp0 on http://localhost:8080  ^(Ctrl+C to stop^)
  py -3 -m http.server 8080
  exit /b %errorlevel%
)

where wsl >nul 2>&1
if %errorlevel% equ 0 (
  echo Serving %~dp0 via WSL + npx serve on http://localhost:8080  ^(Ctrl+C to stop^)
  wsl -d Ubuntu -e bash -lc "source ~/.nvm/nvm.sh && cd '/mnt/c/Users/Jon B/Downloads/hetqml-pages' && npx --yes serve -l 8080 ."
  exit /b %errorlevel%
)

echo Could not find Python or WSL. Install Python, or run:
echo   wsl -d Ubuntu -e bash -lc "cd '/mnt/c/Users/Jon B/Downloads/hetqml-pages' ^&^& npx --yes serve -l 8080 ."
exit /b 1
