# Vaniki Comprehensive TSC TE244 Diagnostic & Test Print Engine
$ErrorActionPreference = "Continue"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $scriptDir
$logFile = Join-Path $scriptDir "service.log"

function Write-Both {
    param([string]$Message, [string]$Color = "White")
    $timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    $line = "[$timestamp] $Message"
    Write-Host $Message -ForegroundColor $Color
    try { Add-Content -Path $logFile -Value $line -ErrorAction SilentlyContinue } catch {}
}

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "        VANIKI TSC TE244 PRINTER DIAGNOSTIC & TEST PRINT" -ForegroundColor Yellow
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host ""

# ---------------------------------------------------------------
# STEP 1: SCAN ALL INSTALLED PRINTERS IN WINDOWS
# ---------------------------------------------------------------
Write-Both "[STEP 1/4] Scanning all installed Windows printers..." "White"

$allPrinters = @()
try {
    $allPrinters = @(Get-CimInstance Win32_Printer)
} catch {
    try { $allPrinters = @(Get-WmiObject Win32_Printer) } catch {}
}

if ($allPrinters.Count -eq 0) {
    Write-Both "[ERROR] No printers detected in Windows! Is Print Spooler running?" "Red"
    Write-Host ""
    Read-Host "Press Enter to exit..."
    exit 1
}

Write-Host ""
Write-Host ("{0,-4} {1,-28} {2,-12} {3,-10} {4,-6}" -f "No.", "Printer Name", "Port", "Status", "Jobs") -ForegroundColor Gray
Write-Host ("-" * 65) -ForegroundColor DarkGray

$tscPrinters = @()
$idx = 1
foreach ($p in $allPrinters) {
    $pName = $p.Name
    $pPort = $p.PortName
    $pStatus = if ($p.WorkOffline) { "OFFLINE" } elseif ($p.PrinterState -eq 1 -or $p.PrinterStatus -eq 1) { "PAUSED" } else { "Normal" }
    
    # Check queue jobs
    $jobCount = 0
    try {
        $jList = @(Get-PrintJob -PrinterName $pName -ErrorAction SilentlyContinue)
        $jobCount = $jList.Count
    } catch {}

    $isMatch = ($pName -match 'TE[-]?244|TSC|TTP[-]?244')
    $color = if ($isMatch) { "Green" } else { "DarkGray" }
    
    if ($isMatch) {
        $tscPrinters += $p
        Write-Host ("[{0,2}] {1,-28} {2,-12} {3,-10} {4,-6} <--- TSC MATCH" -f $idx, $pName, $pPort, $pStatus, $jobCount) -ForegroundColor $color
    } else {
        Write-Host (" {0,2}  {1,-28} {2,-12} {3,-10} {4,-6}" -f $idx, $pName, $pPort, $pStatus, $jobCount) -ForegroundColor $color
    }
    $idx++
}

Write-Host ("-" * 65) -ForegroundColor DarkGray
Write-Host ""

# ---------------------------------------------------------------
# STEP 2 & 3: PROCESS ALL MATCHED TSC PRINTERS
# ---------------------------------------------------------------
Write-Both "[STEP 2/4] Found $($tscPrinters.Count) TSC printer(s) in Windows." "White"

if ($tscPrinters.Count -eq 0) {
    Write-Both "-----------------------------------------------------------------" "Red"
    Write-Both "[CRITICAL ERROR] Windows DOES NOT see any TSC TE244 printer!" "Red"
    Write-Both "-----------------------------------------------------------------" "Red"
    Write-Both "Possible reasons:" "Yellow"
    Write-Both " 1. USB cable is not plugged in firmly or port is loose." "Yellow"
    Write-Both " 2. Printer power switch is OFF (LED lights on printer should be Green)." "Yellow"
    Write-Both " 3. Windows Driver is NOT installed yet." "Yellow"
    Write-Both "-----------------------------------------------------------------" "Red"
    Write-Host ""
    Read-Host "Press Enter to exit..."
    exit 2
}

# ---------------------------------------------------------------
# STEP 4: SEND TEST LABEL TO ALL MATCHED TSC PRINTERS
# ---------------------------------------------------------------
Write-Both "[STEP 3/4] Preparing RAW TSPL 2-Across Test Label..." "White"

$crlf = "`r`n"
$tspl = "SIZE 105 mm, 25 mm" + $crlf +
        "GAP 2 mm, 0 mm" + $crlf +
        "DIRECTION 1" + $crlf +
        "SPEED 2" + $crlf +
        "DENSITY 12" + $crlf +
        "CLS" + $crlf +
        "TEXT 20,12,`"2`",0,1,1,`"VANIKI CROP SCIENCE`"" + $crlf +
        "BAR 20,35,360,2" + $crlf +
        "TEXT 20,48,`"3`",0,1,1,`"TEST STICKER L`"" + $crlf +
        "TEXT 20,82,`"2`",0,1,1,`"Batch: TEST-01`"" + $crlf +
        "TEXT 20,112,`"2`",0,1,1,`"Wt: 500ml`"" + $crlf +
        "TEXT 20,146,`"3`",0,1,1,`"ID: VNK-TEST-01`"" + $crlf +
        "QRCODE 260,48,M,5,A,0,M2,S7,`"VNK-TEST-01`"" + $crlf +
        "TEXT 450,12,`"2`",0,1,1,`"VANIKI CROP SCIENCE`"" + $crlf +
        "BAR 450,35,360,2" + $crlf +
        "TEXT 450,48,`"3`",0,1,1,`"TEST STICKER R`"" + $crlf +
        "TEXT 450,82,`"2`",0,1,1,`"Batch: TEST-02`"" + $crlf +
        "TEXT 450,112,`"2`",0,1,1,`"Wt: 500ml`"" + $crlf +
        "TEXT 450,146,`"3`",0,1,1,`"ID: VNK-TEST-02`"" + $crlf +
        "QRCODE 690,48,M,5,A,0,M2,S7,`"VNK-TEST-02`"" + $crlf +
        "PRINT 1,1" + $crlf

$tmpFile = [System.IO.Path]::GetTempFileName()
$bytes = [System.Text.Encoding]::ASCII.GetBytes($tspl)
[System.IO.File]::WriteAllBytes($tmpFile, $bytes)
$rawScript = Join-Path $scriptDir "raw-print.ps1"

Write-Both "-----------------------------------------------------------------" "DarkGray"
Write-Both "Broadcasting test print to ALL ($($tscPrinters.Count)) TSC printer copies..." "Yellow"
Write-Both "-----------------------------------------------------------------" "DarkGray"

$anySuccess = $false
foreach ($target in $tscPrinters) {
    Write-Host ""
    Write-Both ">>> Testing Printer: '$($target.Name)' on Port '$($target.PortName)' <<<" "Cyan"
    
    # Check stuck jobs
    try {
        $existingJobs = @(Get-PrintJob -PrinterName $target.Name -ErrorAction SilentlyContinue)
        if ($existingJobs.Count -gt 0) {
            Write-Both "    [WARNING] Found $($existingJobs.Count) stuck job(s) in queue for '$($target.Name)'. Clearing..." "Yellow"
            foreach ($ej in $existingJobs) {
                try { Remove-PrintJob -PrinterName $target.Name -ID $ej.Id -ErrorAction SilentlyContinue } catch {}
            }
        }
    } catch {}

    # Print
    $printOutput = & powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$rawScript" -PrinterName $target.Name -FilePath "$tmpFile" -LogFile $logFile
    $code = $LASTEXITCODE
    
    if ($code -eq 0) {
        Write-Both "    [OK] Transmitted successfully to '$($target.Name)' on '$($target.PortName)'" "Green"
        $anySuccess = $true
    } else {
        Write-Both "    [FAILED] Could not send to '$($target.Name)': $printOutput" "Red"
    }
}

try { Remove-Item $tmpFile -Force -ErrorAction SilentlyContinue } catch {}

Write-Host ""
Write-Both "=================================================================" "Green"
Write-Both " [DIAGNOSTIC COMPLETE] Test labels sent to all TSC printers!" "Green"
Write-Both "=================================================================" "Green"
Write-Both "Did your printer print the stickers?" "Yellow"
Write-Both " -> If YES: Note which printer name printed above (e.g. 'TSC TE244 (Copy 1)')." "White"
Write-Both " -> If NO: Check if printer LED light is RED (Red light = ribbon/paper needs calibration: hold PAUSE while turning on power)." "Yellow"
Write-Both "=================================================================" "Green"

Write-Host ""
Read-Host "Diagnostic complete! Press Enter to exit..."
