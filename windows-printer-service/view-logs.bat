@echo off
title Vaniki Printer Service - Live Logs
cd /d "%~dp0"

echo =======================================================
echo          VANIKI PRINTER SERVICE - LIVE LOGS
echo =======================================================
echo.

if not exist service.log (
    echo [INFO] service.log does not exist yet. Creating file...
    echo [%date% %time%] [INFO] Vaniki Logger initialized > service.log
)

echo Streaming live logs from service.log in real-time...
echo (Every status check and print job will show here automatically)
echo (Press Ctrl+C to exit log viewer)
echo -------------------------------------------------------
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Get-Content -Path .\service.log -Wait -Tail 40"

pause
