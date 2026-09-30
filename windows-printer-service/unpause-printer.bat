@echo off
title Unpause TSC TE244 Printer
cd /d "%~dp0"
echo =======================================================
echo          UNPAUSING TSC TE244 PRINTER IN WINDOWS
echo =======================================================
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
  "$printers = @(Get-CimInstance Win32_Printer | Where-Object { $_.Name -match 'TE[-]?244|TSC' }); " ^
  "if ($printers.Count -eq 0) { " ^
  "  Write-Host '[ERROR] No TSC printer found!' -ForegroundColor Red; " ^
  "} else { " ^
  "  foreach ($p in $printers) { " ^
  "    Write-Host \"Processing '$($p.Name)' on '$($p.PortName)'...\" -ForegroundColor Yellow; " ^
  "    try { Resume-Printer -Name $p.Name -ErrorAction SilentlyContinue } catch {}; " ^
  "    try { $p | Invoke-CimMethod -MethodName Resume -ErrorAction SilentlyContinue } catch {}; " ^
  "    try { Set-Printer -Name $p.Name -WorkOffline $false -ErrorAction SilentlyContinue } catch {}; " ^
  "    try { Get-PrintJob -PrinterName $p.Name -ErrorAction SilentlyContinue | Resume-PrintJob -ErrorAction SilentlyContinue } catch {}; " ^
  "    Write-Host \"[SUCCESS] '$($p.Name)' has been UNPAUSED and resumed!\" -ForegroundColor Green; " ^
  "  } " ^
  "}"
echo.
echo If the printer had stuck jobs, they should start printing right now!
echo.
pause
