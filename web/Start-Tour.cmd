@echo off
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo Node.js is required. Please install Node.js, then run this file again.
  pause
  exit /b 1
)
echo Open http://127.0.0.1:4174 in your browser.
echo Keep this window open while viewing the tour.
node serve.mjs
pause
