# Vaniki TSC TE244 Standalone PowerShell HTTP Listener (Port 9191)
# Zero external dependencies: works out of the box on all Windows versions!

$ErrorActionPreference = "Continue"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $scriptDir
$logFile = Join-Path $scriptDir "service.log"
$PORT = 9191

function Write-Both {
    param([string]$Message, [string]$Color = "White")
    $timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    $line = "[$timestamp] $Message"
    Write-Host $line -ForegroundColor $Color
    try { Add-Content -Path $logFile -Value $line -ErrorAction SilentlyContinue } catch {}
}

# Stop any previous process holding port 9191
try {
    $existing = Get-NetTCPConnection -LocalPort $PORT -State Listen -ErrorAction SilentlyContinue
    if ($existing) {
        foreach ($c in $existing) {
            if ($c.OwningProcess -ne $PID) {
                Write-Both "Stopping old process on port $PORT (PID: $($c.OwningProcess))..." "Yellow"
                Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue
            }
        }
        Start-Sleep -Milliseconds 800
    }
} catch {}

# Target Printer Name
$cachedPrinter = "TE244"
function Get-TSCPrinter {
    return $cachedPrinter
}

function Get-PetiWeight($box) {
    if ($box.petiWeight) { return $box.petiWeight }
    if ($box.caseWtStr) { return $box.caseWtStr }
    if ($box.packing -and $box.conversion) {
        if ($box.packing -match '([\d.]+)\s*ML') {
            $ltr = ([double]$matches[1] * [double]$box.conversion) / 1000
            return "$ltr LTR"
        } elseif ($box.packing -match '([\d.]+)\s*GM') {
            $kg = ([double]$matches[1] * [double]$box.conversion) / 1000
            return "$kg KG"
        } elseif ($box.packing -match '([\d.]+)\s*(?:LTR|L)') {
            $ltr = [double]$matches[1] * [double]$box.conversion
            return "$ltr LTR"
        } elseif ($box.packing -match '([\d.]+)\s*KG') {
            $kg = [double]$matches[1] * [double]$box.conversion
            return "$kg KG"
        }
    }
    if ($box.packing) { return $box.packing }
    if ($box.weight -and -not ($box.weight -match 'KGS|30\.000')) { return $box.weight }
    return "10 LTR"
}

function Split-ProductName($name, $maxLen = 16) {
    if (-not $name) { return @{ line1 = "PRODUCT"; line2 = "" } }
    $clean = ($name -replace '["\\]', '').Trim()
    if ($clean.Length -le $maxLen) {
        return @{ line1 = $clean; line2 = "" }
    }

    $splitIdx = -1
    $searchLen = [Math]::Min($clean.Length - 1, $maxLen)
    for ($i = $searchLen; $i -ge 6; $i--) {
        $ch = $clean[$i]
        if ($ch -eq ' ' -or $ch -eq '/' -or $ch -eq '-' -or $ch -eq '(') {
            $splitIdx = $i
            break
        }
    }

    if ($splitIdx -gt 0) {
        $l1 = $clean.Substring(0, $splitIdx).Trim()
        $rem = $clean.Substring($splitIdx).Trim()
        $l2 = $rem.Substring(0, [Math]::Min($maxLen, $rem.Length))
        return @{ line1 = $l1; line2 = $l2 }
    }

    $l1 = $clean.Substring(0, $maxLen)
    $rem = $clean.Substring($maxLen).Trim()
    $l2 = $rem.Substring(0, [Math]::Min($maxLen, $rem.Length))
    return @{ line1 = $l1; line2 = $l2 }
}

# Build 2-Across 50x25mm Label TSPL
function Build-TSPLPair {
    param($leftBox, $rightBox)
    $crlf = "`r`n"
    $cmd = "SIZE 105 mm, 25 mm" + $crlf +
           "GAP 2 mm, 0 mm" + $crlf +
           "DIRECTION 1" + $crlf +
           "SPEED 2" + $crlf +
           "DENSITY 12" + $crlf +
           "CLS" + $crlf

    if ($leftBox) {
        $split = Split-ProductName $leftBox.productName 16
        $line1 = $split.line1
        $line2 = $split.line2
        $batch = ($leftBox.batchNumber -replace '["\\]', '').Trim()
        $batch = $batch.Substring(0, [Math]::Min(14, $batch.Length))
        $wt = Get-PetiWeight $leftBox
        if ($leftBox.petiTag -and -not ($wt -match '\(')) {
            $wt = "$wt$($leftBox.petiTag)"
        }
        $wt = ($wt -replace '["\\]', '').Trim()
        $wt = $wt.Substring(0, [Math]::Min(16, $wt.Length))
        $qr = if ($leftBox.qrId) { $leftBox.qrId } else { "VNK-00" }

        $cmd += "TEXT 20,8,`"2`",0,1,1,`"VANIKI CROP SCIENCE`"" + $crlf
        $cmd += "BAR 20,28,360,2" + $crlf

        if ($line2) {
            $cmd += "TEXT 20,36,`"2`",0,1,1,`"$line1`"" + $crlf
            $cmd += "TEXT 20,62,`"2`",0,1,1,`"$line2`"" + $crlf
            $cmd += "TEXT 20,92,`"2`",0,1,1,`"BA: $batch`"" + $crlf
            $cmd += "TEXT 20,122,`"2`",0,1,1,`"Wt: $wt`"" + $crlf
            $cmd += "TEXT 20,152,`"2`",0,1,1,`"ID: $qr`"" + $crlf
        } else {
            $cmd += "TEXT 20,40,`"2`",0,1,1,`"$line1`"" + $crlf
            $cmd += "TEXT 20,72,`"2`",0,1,1,`"BA: $batch`"" + $crlf
            $cmd += "TEXT 20,104,`"2`",0,1,1,`"Wt: $wt`"" + $crlf
            $cmd += "TEXT 20,136,`"2`",0,1,1,`"ID: $qr`"" + $crlf
        }
        $cmd += "QRCODE 260,36,M,5,A,0,M2,S7,`"$qr`"" + $crlf
    }

    if ($rightBox) {
        $split = Split-ProductName $rightBox.productName 16
        $line1 = $split.line1
        $line2 = $split.line2
        $batch = ($rightBox.batchNumber -replace '["\\]', '').Trim()
        $batch = $batch.Substring(0, [Math]::Min(14, $batch.Length))
        $wt = Get-PetiWeight $rightBox
        if ($rightBox.petiTag -and -not ($wt -match '\(')) {
            $wt = "$wt$($rightBox.petiTag)"
        }
        $wt = ($wt -replace '["\\]', '').Trim()
        $wt = $wt.Substring(0, [Math]::Min(16, $wt.Length))
        $qr = if ($rightBox.qrId) { $rightBox.qrId } else { "VNK-00" }

        $cmd += "TEXT 450,8,`"2`",0,1,1,`"VANIKI CROP SCIENCE`"" + $crlf
        $cmd += "BAR 450,28,360,2" + $crlf

        if ($line2) {
            $cmd += "TEXT 450,36,`"2`",0,1,1,`"$line1`"" + $crlf
            $cmd += "TEXT 450,62,`"2`",0,1,1,`"$line2`"" + $crlf
            $cmd += "TEXT 450,92,`"2`",0,1,1,`"BA: $batch`"" + $crlf
            $cmd += "TEXT 450,122,`"2`",0,1,1,`"Wt: $wt`"" + $crlf
            $cmd += "TEXT 450,152,`"2`",0,1,1,`"ID: $qr`"" + $crlf
        } else {
            $cmd += "TEXT 450,40,`"2`",0,1,1,`"$line1`"" + $crlf
            $cmd += "TEXT 450,72,`"2`",0,1,1,`"BA: $batch`"" + $crlf
            $cmd += "TEXT 450,104,`"2`",0,1,1,`"Wt: $wt`"" + $crlf
            $cmd += "TEXT 450,136,`"2`",0,1,1,`"ID: $qr`"" + $crlf
        }
        $cmd += "QRCODE 690,36,M,5,A,0,M2,S7,`"$qr`"" + $crlf
    }

    $cmd += "PRINT 1,1" + $crlf
    return $cmd
}

function Send-RawTSPL {
    param([string]$tsplString)
    $printer = Get-TSCPrinter
    $tmpFile = [System.IO.Path]::GetTempFileName()
    $bytes = [System.Text.Encoding]::ASCII.GetBytes($tsplString)
    [System.IO.File]::WriteAllBytes($tmpFile, $bytes)
    $rawScript = Join-Path $scriptDir "raw-print.ps1"
    
    $out = & powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$rawScript" -PrinterName "$printer" -FilePath "$tmpFile" -LogFile "$logFile"
    try { Remove-Item $tmpFile -Force -ErrorAction SilentlyContinue } catch {}
    
    return @{ success = ($LASTEXITCODE -eq 0); printer = $printer; output = $out }
}

# Start HttpListener
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://127.0.0.1:$PORT/")
$listener.Prefixes.Add("http://localhost:$PORT/")

try {
    $listener.Start()
} catch {
    Write-Both "[FATAL] Could not start HttpListener on port $PORT: $($_.Exception.Message)" "Red"
    exit 1
}

$detected = Get-TSCPrinter
Write-Both "=================================================================" "Cyan"
Write-Both "  VANIKI TSC TE244 NATIVE PRINTER SERVICE (PORT $PORT)" "Yellow"
Write-Both "  Listening on: http://127.0.0.1:$PORT & http://localhost:$PORT" "Green"
Write-Both "  Detected Printer: $detected" "Cyan"
Write-Both "  Private Network Access (PNA) & CORS: ENABLED" "Green"
Write-Both "=================================================================" "Cyan"

while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $req = $context.Request
        $res = $context.Response

        $origin = $req.Headers["Origin"]
        if (-not $origin) { $origin = "*" }

        # CORS & Chrome PNA Headers
        $res.Headers.Add("Access-Control-Allow-Origin", $origin)
        $res.Headers.Add("Access-Control-Allow-Credentials", "true")
        $res.Headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        $res.Headers.Add("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Access-Control-Request-Private-Network")
        $res.Headers.Add("Access-Control-Allow-Private-Network", "true")

        $rawUrl = $req.RawUrl
        $method = $req.HttpMethod

        if ($method -eq "OPTIONS") {
            $res.StatusCode = 204
            $res.Close()
            continue
        }

        if ($method -eq "GET" -and ($rawUrl -match "^/(status|health)")) {
            $pName = Get-TSCPrinter
            $json = @{
                success = $true
                connected = $true
                status = "ready"
                printer = $pName
                platform = "win32"
                roll = "2-Across 50x25mm"
            } | ConvertTo-Json
            
            $res.ContentType = "application/json"
            $res.StatusCode = 200
            $buffer = [System.Text.Encoding]::UTF8.GetBytes($json)
            $res.OutputStream.Write($buffer, 0, $buffer.Length)
            $res.Close()
            continue
        }

        if (($method -eq "GET" -or $method -eq "POST") -and ($rawUrl -match "^/test-print")) {
            Write-Both "[HTTP] /test-print requested" "Cyan"
            $testTSPL = Build-TSPLPair `
                @{ productName = "TEST STICKER L"; batchNumber = "B-TEST01"; weight = "500ml"; qrId = "VNK-TEST-01" } `
                @{ productName = "TEST STICKER R"; batchNumber = "B-TEST02"; weight = "500ml"; qrId = "VNK-TEST-02" }
            $ret = Send-RawTSPL -tsplString $testTSPL
            
            $json = @{
                success = $ret.success
                printer = $ret.printer
                message = "Test sticker sent to $($ret.printer)"
            } | ConvertTo-Json

            $res.ContentType = "application/json"
            $res.StatusCode = 200
            $buffer = [System.Text.Encoding]::UTF8.GetBytes($json)
            $res.OutputStream.Write($buffer, 0, $buffer.Length)
            $res.Close()
            continue
        }

        if ($method -eq "POST" -and ($rawUrl -match "^/print-boxes")) {
            $reader = New-Object System.IO.StreamReader($req.InputStream, [System.Text.Encoding]::UTF8)
            $body = $reader.ReadToEnd()
            $reader.Close()

            $parsed = $body | ConvertFrom-Json
            $boxes = @($parsed.boxes)
            Write-Both "[HTTP] /print-boxes received $($boxes.Count) box(es)" "Cyan"

            $fullTSPL = ""
            for ($i = 0; $i -lt $boxes.Count; $i += 2) {
                $left = $boxes[$i]
                $right = if ($i + 1 -lt $boxes.Count) { $boxes[$i + 1] } else { $null }
                $fullTSPL += Build-TSPLPair $left $right
            }

            $ret = Send-RawTSPL -tsplString $fullTSPL

            $json = @{
                success = $ret.success
                count = $boxes.Count
                printer = $ret.printer
                message = "Printed $($boxes.Count) stickers on $($ret.printer)"
            } | ConvertTo-Json

            $res.ContentType = "application/json"
            $res.StatusCode = if ($ret.success) { 200 } else { 500 }
            $buffer = [System.Text.Encoding]::UTF8.GetBytes($json)
            $res.OutputStream.Write($buffer, 0, $buffer.Length)
            $res.Close()
            continue
        }

        # 404
        $res.StatusCode = 404
        $json = @{ error = "Not found" } | ConvertTo-Json
        $res.ContentType = "application/json"
        $buffer = [System.Text.Encoding]::UTF8.GetBytes($json)
        $res.OutputStream.Write($buffer, 0, $buffer.Length)
        $res.Close()
    } catch {
        Write-Both "[ERROR] Server loop: $($_.Exception.Message)" "Red"
    }
}
