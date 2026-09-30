<#
.SYNOPSIS
    Vaniki Raw TSPL Direct Printer Engine for Windows
    Uses winspool.drv (Unicode OpenPrinterW) with detailed logging and queue inspection.
#>
param(
    [Parameter(Mandatory=$false)][string]$PrinterName = "TE244",
    [Parameter(Mandatory=$true)][string]$FilePath,
    [Parameter(Mandatory=$false)][string]$LogFile = ""
)

$ErrorActionPreference = "Continue"

function Write-Log {
    param([string]$Message, [string]$Color = "White")
    $timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    $formatted = "[$timestamp] $Message"
    Write-Host $formatted -ForegroundColor $Color
    if ($LogFile -and (Test-Path (Split-Path $LogFile -Parent))) {
        try { Add-Content -Path $LogFile -Value $formatted -ErrorAction SilentlyContinue } catch {}
    }
}

# WinSpool Unicode P/Invoke Definition
$code = @"
using System;
using System.IO;
using System.Runtime.InteropServices;

public class RawPrinterHelper {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public class DOCINFOW {
        [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPWStr)] public string pDataType;
    }

    [DllImport("winspool.drv", EntryPoint = "OpenPrinterW", SetLastError = true, CharSet = CharSet.Unicode, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool OpenPrinter([MarshalAs(UnmanagedType.LPWStr)] string szPrinter, out IntPtr hPrinter, IntPtr pd);

    [DllImport("winspool.drv", EntryPoint = "ClosePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", EntryPoint = "StartDocPrinterW", SetLastError = true, CharSet = CharSet.Unicode, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern Int32 StartDocPrinter(IntPtr hPrinter, Int32 level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOW di);

    [DllImport("winspool.drv", EntryPoint = "EndDocPrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", EntryPoint = "StartPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", EntryPoint = "EndPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", EntryPoint = "WritePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, Int32 dwCount, out Int32 dwWritten);

    public static string LastDetail = "";
    public static int BytesWritten = 0;
    public static int JobId = 0;

    public static bool SendFileToPrinter(string szPrinterName, string szFileName) {
        LastDetail = "";
        BytesWritten = 0;
        JobId = 0;

        if (!File.Exists(szFileName)) {
            LastDetail = "Error: Input file not found: " + szFileName;
            return false;
        }

        byte[] bytes = File.ReadAllBytes(szFileName);
        if (bytes.Length == 0) {
            LastDetail = "Error: Input file is empty (0 bytes).";
            return false;
        }

        IntPtr pUnmanagedBytes = Marshal.AllocCoTaskMem(bytes.Length);
        Marshal.Copy(bytes, 0, pUnmanagedBytes, bytes.Length);

        IntPtr hPrinter = IntPtr.Zero;
        DOCINFOW di = new DOCINFOW();
        di.pDocName = "Vaniki TSPL Sticker Job";
        di.pOutputFile = null;
        di.pDataType = "RAW";

        bool bSuccess = false;

        if (OpenPrinter(szPrinterName, out hPrinter, IntPtr.Zero)) {
            JobId = StartDocPrinter(hPrinter, 1, di);
            if (JobId > 0) {
                if (StartPagePrinter(hPrinter)) {
                    int dwWritten = 0;
                    bSuccess = WritePrinter(hPrinter, pUnmanagedBytes, bytes.Length, out dwWritten);
                    BytesWritten = dwWritten;
                    EndPagePrinter(hPrinter);
                    if (!bSuccess) {
                        LastDetail = "WritePrinter failed. Win32 Error: " + Marshal.GetLastWin32Error();
                    } else {
                        LastDetail = "Success: " + dwWritten + " bytes written. Job ID: " + JobId;
                    }
                } else {
                    LastDetail = "StartPagePrinter failed. Win32 Error: " + Marshal.GetLastWin32Error();
                }
                EndDocPrinter(hPrinter);
            } else {
                LastDetail = "StartDocPrinter failed. Win32 Error: " + Marshal.GetLastWin32Error();
            }
            ClosePrinter(hPrinter);
        } else {
            LastDetail = "OpenPrinter failed for '" + szPrinterName + "'. Win32 Error: " + Marshal.GetLastWin32Error();
        }

        Marshal.FreeCoTaskMem(pUnmanagedBytes);
        return bSuccess;
    }
}
"@

if (-not ([System.Management.Automation.PSTypeName]'RawPrinterHelper').Type) {
    Add-Type -TypeDefinition $code
}

if (-not (Test-Path $FilePath)) {
    Write-Log "[ERROR] File not found: $FilePath" "Red"
    exit 2
}

$fileSize = (Get-Item $FilePath).Length
Write-Log "[PRINT] Payload size: $fileSize bytes" "Cyan"

# Scan installed printers
$printers = @()
try {
    $printers = @(Get-CimInstance Win32_Printer)
} catch {
    try { $printers = @(Get-WmiObject Win32_Printer) } catch {}
}

if ($printers.Count -eq 0) {
    Write-Log "[ERROR] No printers detected in Windows Spooler!" "Red"
    exit 3
}

# Resolve target printer
$target = $null

# 1. Exact name match
$target = $printers | Where-Object { $_.Name -eq $PrinterName } | Select-Object -First 1

# 2. Match containing TE244 / TE-244
if (-not $target) {
    $target = $printers | Where-Object { $_.Name -match 'TE[-]?244' } | Select-Object -First 1
}

# 3. Match containing TSC
if (-not $target) {
    $target = $printers | Where-Object { $_.Name -match 'TSC' } | Select-Object -First 1
}

# 4. Strict check - Do NOT fallback to virtual/PDF printers!
if (-not $target) {
    Write-Log "[ERROR] No TSC TE244 printer matched! Target was: '$PrinterName'" "Red"
    Write-Log "[ERROR] Installed printers on this PC:" "Yellow"
    foreach ($p in $printers) {
        Write-Log "   -> '$($p.Name)' (Port: $($p.PortName), Status: $($p.PrinterStatus))" "Yellow"
    }
    Write-Log "[ERROR] Please check Windows 'Printers & Scanners' to see what name Windows gave your TSC printer." "Red"
    exit 4
}

Write-Log "[TARGET] Printing to: '$($target.Name)' on Port: '$($target.PortName)'" "Green"

# Check if printer is Offline or Paused, and automatically unpause it!
try {
    if ($target.WorkOffline) {
        Write-Log "[ACTION] Printer '$($target.Name)' is marked OFFLINE in Windows! Setting to ONLINE..." "Yellow"
        try { Set-Printer -Name $target.Name -WorkOffline $false -ErrorAction SilentlyContinue } catch {}
    }
    if ($target.PrinterState -eq 1 -or $target.PrinterStatus -eq 1) {
        Write-Log "[ACTION] Printer '$($target.Name)' is PAUSED in Windows! Unpausing automatically..." "Yellow"
        try { Resume-Printer -Name $target.Name -ErrorAction SilentlyContinue } catch {}
        try {
            $cimP = Get-CimInstance Win32_Printer -Filter "Name = '$($target.Name)'"
            $cimP | Invoke-CimMethod -MethodName Resume -ErrorAction SilentlyContinue
        } catch {}
        try { Get-PrintJob -PrinterName $target.Name -ErrorAction SilentlyContinue | Resume-PrintJob -ErrorAction SilentlyContinue } catch {}
        Start-Sleep -Milliseconds 500
        Write-Log "[OK] Unpause signal sent to '$($target.Name)'." "Green"
    }
} catch {}

# Execute RAW WinSpool send
$ok = [RawPrinterHelper]::SendFileToPrinter($target.Name, $FilePath)
$detail = [RawPrinterHelper]::LastDetail

if ($ok) {
    Write-Log "[SUCCESS] $detail" "Green"
    
    # Check queue after send
    Start-Sleep -Milliseconds 600
    try {
        $jobs = @(Get-PrintJob -PrinterName $target.Name -ErrorAction SilentlyContinue)
        if ($jobs.Count -gt 0) {
            Write-Log "[QUEUE] Currently $($jobs.Count) job(s) in spooler queue for '$($target.Name)'" "Cyan"
            foreach ($j in $jobs) {
                Write-Log "   -> Job ID: $($j.Id), Status: $($j.JobStatus), Size: $($j.TotalPages)p" "DarkCyan"
            }
        } else {
            Write-Log "[QUEUE] Spooler queue is clear (data transferred to physical printer hardware)." "Green"
        }
    } catch {}

    exit 0
} else {
    Write-Log "[ERROR] Failed to send RAW bytes: $detail" "Red"
    
    # Method 2 Fallback: If printer is shared, try UNC direct copy
    if ($target.Shared -and $target.ShareName) {
        Write-Log "[FALLBACK] Attempting direct UNC pipe to '\\127.0.0.1\$($target.ShareName)'..." "Yellow"
        try {
            cmd.exe /c "copy /b `"$FilePath`" `"\\127.0.0.1\$($target.ShareName)`""
            if ($LASTEXITCODE -eq 0) {
                Write-Log "[SUCCESS] Direct UNC copy succeeded via share '$($target.ShareName)'" "Green"
                exit 0
            }
        } catch {
            Write-Log "[FALLBACK ERROR] UNC pipe copy failed: $($_.Exception.Message)" "Red"
        }
    }
    
    exit 1
}
