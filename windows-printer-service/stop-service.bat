@echo off
title Stop Vaniki TSC Printer Service
cd /d "%~dp0"

echo =======================================================
echo         STOPPING VANIKI TSC PRINTER SERVICE
echo =======================================================
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
  "$conns = Get-NetTCPConnection -LocalPort 9191 -State Listen -ErrorAction SilentlyContinue; " ^
  "if ($conns) { " ^
  "  foreach ($c in $conns) { " ^
  "    Write-Host \"Stopping process on port 9191 (PID: $($c.OwningProcess))...\" -ForegroundColor Yellow; " ^
  "    Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue; " ^
  "  } " ^
  "  Write-Host '[OK] Printer service stopped successfully.' -ForegroundColor Green; " ^
  "} else { " ^
  "  Write-Host '[INFO] No service was actively running on port 9191.' -ForegroundColor Gray; " ^
  "}"

echo.
pause
