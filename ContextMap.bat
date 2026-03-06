@echo off
title ContextMap
cd /d "%~dp0"
echo Starting ContextMap...
start "" http://localhost:3001
npx tsx server/index.ts
pause
