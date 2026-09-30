@echo off
title Vaniki TSC Test Print
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0test-print.ps1"
echo.
pause
