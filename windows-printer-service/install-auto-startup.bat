@echo off
title Install Vaniki Printer Auto-Startup
cd /d "%~dp0"

echo =======================================================
echo     INSTALL VANIKI PRINTER SERVICE ON WINDOWS STARTUP
echo =======================================================
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
  "$scriptDir = (Get-Location).Path; " ^
  "$cmdVal = \"powershell.exe -WindowStyle Hidden -NoProfile -ExecutionPolicy Bypass -File `\"$scriptDir\run-silent.ps1`\"\"; " ^
  "try { " ^
  "  Set-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run' -Name 'VanikiPrinterService' -Value $cmdVal -ErrorAction Stop; " ^
  "  Write-Host '[SUCCESS] Auto-Startup registry entry created!' -ForegroundColor Green; " ^
  "} catch { " ^
  "  Write-Host ('[WARN] ' + $_.Exception.Message) -ForegroundColor Yellow; " ^
  "}"

rem Also register in Windows Task Scheduler for 100% guaranteed 24/7 startup on boot/login
schtasks /create /tn "VanikiPrinterService" /tr "powershell.exe -WindowStyle Hidden -NoProfile -ExecutionPolicy Bypass -File \"%~dp0run-silent.ps1\"" /sc onlogon /rl highest /f >nul 2>&1
if %ERRORLEVEL% EQU 0 (
  echo [SUCCESS] Windows Task Scheduler entry registered!
)

echo.
echo =======================================================
echo [OK] PC chahe kitni bhi baar ON/OFF ho, background me
echo      printer service hamesha automatically chalu rahegi!
echo =======================================================
echo.
echo Starting service right now in background...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0run-silent.ps1"

echo.
echo =======================================================
echo Checking background service status on Port 9191...
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
  "Start-Sleep -Seconds 2; " ^
  "try { " ^
  "  $res = Invoke-RestMethod -Uri 'http://127.0.0.1:9191/status' -TimeoutSec 3; " ^
  "  Write-Host '[SUCCESS] Service background me ACTIVE & RUNNING hai!' -ForegroundColor Green; " ^
  "  Write-Host ('Printer: ' + $res.printer + ' | Port: 9191 (ONLINE)') -ForegroundColor Cyan; " ^
  "} catch { " ^
  "  Write-Host '[INFO] Service background me trigger ho chuki hai.' -ForegroundColor Yellow; " ^
  "}"
echo =======================================================
echo.
echo NOTE: Service background (hidden) me 24/7 chalti rahegi!
echo Ye installer window ab band kar sakte hain.
echo.
echo Press any key to exit this window...
pause >nul
exit /b 0
