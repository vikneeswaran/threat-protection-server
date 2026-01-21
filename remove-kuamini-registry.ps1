# Advanced Kuamini Registry Cleanup
# This script removes the Kuamini entry from Control Panel

param([switch]$Force)

$ErrorActionPreference = "Stop"

# Check if running as admin
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) { 
    Write-Host "ERROR: This script requires Administrator privileges" -ForegroundColor Red
    Exit 1
}

Write-Host "Kuamini Registry Cleanup Script`n" -ForegroundColor Cyan

# Function to find and remove registry entries
function Remove-KuaminiRegistryEntry {
    param([string]$Path, [string]$Pattern)
    
    Write-Host "Checking: $Path" -ForegroundColor Gray
    
    $entries = Get-ChildItem $Path -ErrorAction SilentlyContinue | ForEach-Object {
        $entry = Get-ItemProperty $_.PSPath -ErrorAction SilentlyContinue
        if ($entry -and $entry.DisplayName -like $Pattern) {
            $entry
        }
    }
    
    foreach ($entry in $entries) {
        Write-Host "  Found: $($entry.DisplayName)" -ForegroundColor Yellow
        if ($Force -or (Read-Host "Remove? (y/n)") -eq "y") {
            Remove-Item $entry.PSPath -Force -ErrorAction SilentlyContinue
            Write-Host "  [OK] Removed" -ForegroundColor Green
        }
    }
}

# Search both 32-bit and 64-bit registry paths
$registryPaths = @(
    "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall",
    "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall"
)

$found = 0
foreach ($path in $registryPaths) {
    if (Test-Path $path) {
        $items = @(Get-ChildItem $path -ErrorAction SilentlyContinue)
        foreach ($item in $items) {
            $itemProps = Get-ItemProperty $item.PSPath -ErrorAction SilentlyContinue
            if ($itemProps.DisplayName -like "*Kuamini*") {
                Write-Host "`nFound Kuamini entry:" -ForegroundColor Yellow
                Write-Host "  Path: $($item.PSPath)" -ForegroundColor Gray
                Write-Host "  Name: $($itemProps.DisplayName)" -ForegroundColor Gray
                
                if ($Force) {
                    try {
                        Remove-Item $item.PSPath -Force -Recurse -ErrorAction Stop
                        Write-Host "  [OK] Registry entry removed" -ForegroundColor Green
                        $found++
                    } catch {
                        Write-Host "  [ERROR] Failed to remove: $_" -ForegroundColor Red
                    }
                }
            }
        }
    }
}

if ($found -eq 0) {
    Write-Host "`n[OK] No Kuamini registry entries found in Control Panel" -ForegroundColor Green
} else {
    Write-Host "`n[OK] Removed $found Kuamini entry(entries)" -ForegroundColor Green
}

Write-Host ""
