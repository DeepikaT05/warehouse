@echo off
title Uninstall Vaniki Printer Auto-Startup
cd /d "%~dp0"

echo =======================================================
echo     UNINSTALL VANIKI PRINTER SERVICE AUTO-STARTUP
echo =======================================================
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
  "try { " ^
  "  Remove-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run' -Name 'VanikiPrinterService' -ErrorAction SilentlyContinue; " ^
  "  Write-Host '[OK] Auto-Startup registry entry removed.' -ForegroundColor Green; " ^
  "} catch {}"

schtasks /delete /tn "VanikiPrinterService" /f >nul 2>&1
echo [OK] Windows Task Scheduler entry removed.

echo.
pause
