@echo off
title ContextMap
cd /d "%~dp0"
echo Starting ContextMap...
npx tsx server/index.ts
pause
