@echo off
title Vaniki TSC Background Service Launcher
cd /d "%~dp0"

echo =======================================================
echo      STARTING VANIKI PRINTER SERVICE IN BACKGROUND
echo =======================================================
echo.

echo [1/2] Launching silent process in background...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0run-silent.ps1"

echo [2/2] Verifying service on port 9191...
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
  "$started = $false; " ^
  "for ($i = 0; $i -lt 12; $i++) { " ^
  "  Start-Sleep -Milliseconds 400; " ^
  "  $c = Get-NetTCPConnection -LocalPort 9191 -State Listen -ErrorAction SilentlyContinue; " ^
  "  if ($c) { $started = $true; break; } " ^
  "} " ^
  "if ($started) { " ^
  "  Write-Host ''; " ^
  "  Write-Host '=======================================================' -ForegroundColor Green; " ^
  "  Write-Host ' [SUCCESS] Service is now RUNNING IN THE BACKGROUND!' -ForegroundColor Green; " ^
  "  Write-Host ' Port: 9191 | Direct 1-Click Print is Active' -ForegroundColor Cyan; " ^
  "  Write-Host ' (Aap is window ko band kar sakte hain)' -ForegroundColor Yellow; " ^
  "  Write-Host '=======================================================' -ForegroundColor Green; " ^
  "} else { " ^
  "  Write-Host '[ERROR] Could not confirm port 9191. Check service.log' -ForegroundColor Red; " ^
  "}"

echo.
echo Window closing in 3 seconds...
timeout /t 3 >nul
exit /b 0
