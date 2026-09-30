# Vaniki TSC Printer Silent Background Runner
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $scriptDir

# Stop any old process holding port 9191
try {
    $conns = Get-NetTCPConnection -LocalPort 9191 -State Listen -ErrorAction SilentlyContinue
    if ($conns) {
        foreach ($c in $conns) {
            Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue
        }
        Start-Sleep -Milliseconds 400
    }
} catch {}

# Launch Node or PowerShell service in completely hidden background
if (Get-Command node -ErrorAction SilentlyContinue) {
    Start-Process -WindowStyle Hidden -FilePath "node.exe" -ArgumentList "local-printer-service.js" -WorkingDirectory $scriptDir
} else {
    Start-Process -WindowStyle Hidden -FilePath "powershell.exe" -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File printer-service.ps1" -WorkingDirectory $scriptDir
}
