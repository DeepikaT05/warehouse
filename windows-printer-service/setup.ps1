# Vaniki TSC TE244 Printer Service Setup Script
$ErrorActionPreference = "Continue"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "       VANIKI TSC TE244 PRINTER SERVICE SETUP" -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $scriptDir

# ----------------------------------------------------
# 1. CHECK / INSTALL NODE.JS
# ----------------------------------------------------
Write-Host "[1/5] Checking Node.js installation..." -ForegroundColor White
$nodeInstalled = $false
try {
    $nodeVer = & node -v 2>$null
    if ($nodeVer) {
        Write-Host "  [OK] Node.js is installed: $nodeVer" -ForegroundColor Green
        $nodeInstalled = $true
    }
} catch {}

if (-not $nodeInstalled) {
    Write-Host "  [!] Node.js not detected in PATH." -ForegroundColor Yellow
    Write-Host "  [*] Attempting automatic installation via winget..." -ForegroundColor Gray
    
    $installedViaWinget = $false
    try {
        & winget install OpenJS.NodeJS.LTS --silent --accept-package-agreements --accept-source-agreements
        if ($LASTEXITCODE -eq 0) {
            $installedViaWinget = $true
        }
    } catch {}

    # Refresh PATH in current process
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

    try {
        $nodeVer = & node -v 2>$null
        if ($nodeVer) {
            Write-Host "  [OK] Node.js installed successfully: $nodeVer" -ForegroundColor Green
            $nodeInstalled = $true
        }
    } catch {}

    if (-not $nodeInstalled) {
        Write-Host ""
        Write-Host "  [ACTION REQUIRED] Please manually install Node.js (LTS version):" -ForegroundColor Red
        Write-Host "  Download link: https://nodejs.org/" -ForegroundColor Cyan
        Write-Host "  After installing Node.js, run setup.bat again." -ForegroundColor Yellow
        Write-Host ""
        Read-Host "Press Enter to exit"
        exit 1
    }
}

Write-Host ""

# ----------------------------------------------------
# 2. DETECT CONNECTED TSC PRINTER
# ----------------------------------------------------
Write-Host "[2/5] Scanning Windows printers for TSC TE244..." -ForegroundColor White
$installedPrinters = @()
try {
    $installedPrinters = @(Get-CimInstance Win32_Printer | Select-Object -ExpandProperty Name)
} catch {
    try {
        $installedPrinters = @(Get-WmiObject Win32_Printer | Select-Object -ExpandProperty Name)
    } catch {}
}

$matchedPrinter = $null
if ($installedPrinters.Count -gt 0) {
    Write-Host "  Detected printers on this PC:" -ForegroundColor Gray
    foreach ($p in $installedPrinters) {
        if ($p -match 'TE[-]?244|TSC') {
            Write-Host "   -> [FOUND TSC] $p" -ForegroundColor Green
            if (-not $matchedPrinter) { $matchedPrinter = $p }
        } else {
            Write-Host "      $p" -ForegroundColor DarkGray
        }
    }
} else {
    Write-Host "  [!] No printers detected via Windows spooler." -ForegroundColor Yellow
}

if ($matchedPrinter) {
    Write-Host "  [OK] Target Printer: '$matchedPrinter'" -ForegroundColor Green
} else {
    Write-Host "  [NOTE] TE244 not explicitly matched. The service will fallback to 'TE244' or any TSC printer." -ForegroundColor Yellow
}

Write-Host ""

# ----------------------------------------------------
# 3. CLEAN PORT 9191 IF PREVIOUSLY OCCUPIED
# ----------------------------------------------------
Write-Host "[3/5] Checking port 9191..." -ForegroundColor White
try {
    $conns = Get-NetTCPConnection -LocalPort 9191 -State Listen -ErrorAction SilentlyContinue
    if ($conns) {
        foreach ($c in $conns) {
            Write-Host "  Stopping existing instance (PID: $($c.OwningProcess))..." -ForegroundColor Gray
            Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue
        }
        Start-Sleep -Seconds 1
    }
    Write-Host "  [OK] Port 9191 is clean." -ForegroundColor Green
} catch {
    # Fallback to netstat / taskkill
    cmd.exe /c "for /f `"tokens=5`" %a in ('netstat -aon ^| findstr :9191 ^| findstr LISTENING') do taskkill /f /pid %a >nul 2>nul"
    Write-Host "  [OK] Port 9191 verified." -ForegroundColor Green
}

Write-Host ""

# ----------------------------------------------------
# 4. CONFIGURE AUTO-START ON BOOT
# ----------------------------------------------------
Write-Host "[4/5] Setting up Windows Auto-Start..." -ForegroundColor White
$startupFolder = [System.Environment]::GetFolderPath('Startup')
$startupFile = Join-Path $startupFolder "Vaniki-TSC-Printer.vbs"
$startBatchPath = Join-Path $scriptDir "start-service.bat"

$vbsContent = @"
' Vaniki TSC Printer Auto-Start
Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "cmd /c """ & "$startBatchPath" & """", 0, False
"@

[System.IO.File]::WriteAllText($startupFile, $vbsContent)
Write-Host "  [OK] Auto-Start enabled in: $startupFile" -ForegroundColor Green

# Desktop Shortcut
try {
    $desktopFolder = [System.Environment]::GetFolderPath('Desktop')
    $shortcutPath = Join-Path $desktopFolder "Vaniki TSC Printer.lnk"
    $ws = New-Object -ComObject WScript.Shell
    $shortcut = $ws.CreateShortcut($shortcutPath)
    $shortcut.TargetPath = $startBatchPath
    $shortcut.WorkingDirectory = $scriptDir
    $shortcut.Description = "Start Vaniki TSC TE244 Printer Service"
    $shortcut.Save()
    Write-Host "  [OK] Created Desktop shortcut: 'Vaniki TSC Printer'" -ForegroundColor Green
} catch {
    Write-Host "  [!] Could not create desktop shortcut (skipped)." -ForegroundColor DarkGray
}

Write-Host ""

# ----------------------------------------------------
# 5. START SERVICE AND VERIFY
# ----------------------------------------------------
Write-Host "[5/5] Starting printer service in background..." -ForegroundColor White
& wscript.exe "$startupFile"
Start-Sleep -Seconds 2

$verified = $false
try {
    $resp = Invoke-RestMethod -Uri "http://127.0.0.1:9191/status" -TimeoutSec 4
    if ($resp.success) {
        $verified = $true
        Write-Host ""
        Write-Host "==========================================================" -ForegroundColor Green
        Write-Host " [SUCCESS] Vaniki Printer Service is RUNNING on Port 9191!" -ForegroundColor Green
        Write-Host " Active Printer : $($resp.printer)" -ForegroundColor Cyan
        Write-Host " Platform       : $($resp.platform)" -ForegroundColor Cyan
        Write-Host " Sticker Specs  : $($resp.roll)" -ForegroundColor Cyan
        Write-Host " Auto-Start     : ACTIVE (Runs automatically on Windows boot)" -ForegroundColor Yellow
        Write-Host "==========================================================" -ForegroundColor Green
    }
} catch {}

if (-not $verified) {
    Write-Host "  [!] Status check did not respond within 4s." -ForegroundColor Yellow
    Write-Host "  You can start it manually anytime by double-clicking 'start-service.bat'." -ForegroundColor Gray
}

Write-Host ""
Write-Host "----------------------------------------------------------" -ForegroundColor DarkGray
Write-Host "Next Steps:" -ForegroundColor White
Write-Host " 1. To test the printer physically, double-click 'test-print.bat'." -ForegroundColor Cyan
Write-Host " 2. Open https://warehouse.vanikicrop.com in Chrome/Edge and print!" -ForegroundColor Cyan
Write-Host "----------------------------------------------------------" -ForegroundColor DarkGray
Write-Host ""

$testNow = Read-Host "Do you want to test print a sample sticker right now? (y/n)"
if ($testNow -eq 'y' -or $testNow -eq 'Y') {
    Write-Host "[*] Triggering test print..." -ForegroundColor Yellow
    try {
        $printResp = Invoke-RestMethod -Uri "http://127.0.0.1:9191/test-print" -TimeoutSec 5
        if ($printResp.success) {
            Write-Host " [OK] $($printResp.message)" -ForegroundColor Green
        } else {
            Write-Host " [ERROR] $($printResp.error)" -ForegroundColor Red
        }
    } catch {
        Write-Host " [!] Test print API error: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Read-Host "Setup complete! Press Enter to exit this window..."
