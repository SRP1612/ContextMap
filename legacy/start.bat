@echo off
title ContextMap
cd /d "%~dp0"
echo Starting ContextMap...
echo.
echo Once you see "ContextMap running at http://localhost:3001", open that URL in your browser.
echo Press Ctrl+C to stop.
echo.
npx tsx server/index.ts
pause
