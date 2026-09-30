@echo off
title Vaniki TSC Printer Setup
cd /d "%~dp0"
echo ==========================================================
echo       VANIKI TSC TE244 PRINTER SERVICE SETUP
echo ==========================================================
echo.
echo Launching setup configuration...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup.ps1"
if %errorlevel% neq 0 (
    echo.
    echo [NOTE] Setup exited with status code %errorlevel%.
)
echo.
pause
