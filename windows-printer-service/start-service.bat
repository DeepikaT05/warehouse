@echo off
title Vaniki-TSC-Printer
cd /d "%~dp0"

echo =======================================================
echo     VANIKI TSC TE244 LOCAL PRINTER SERVICE (PORT 9191)
echo =======================================================
echo.

:: Clean up any old process holding port 9191
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
  "$conns = Get-NetTCPConnection -LocalPort 9191 -State Listen -ErrorAction SilentlyContinue; " ^
  "if ($conns) { " ^
  "  foreach ($c in $conns) { " ^
  "    Write-Host \"Cleaning up old service on port 9191 (PID: $($c.OwningProcess))...\" -ForegroundColor Yellow; " ^
  "    Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue; " ^
  "  } " ^
  "  Start-Sleep -Milliseconds 500; " ^
  "}"

where node >nul 2>nul
if %errorlevel% equ 0 (
    echo [INFO] Node.js detected. Launching Node printer service...
    echo.
    node local-printer-service.js
    pause
    exit /b 0
)

echo [INFO] Node.js not found in PATH. Launching native PowerShell printer service...
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0printer-service.ps1"
pause
