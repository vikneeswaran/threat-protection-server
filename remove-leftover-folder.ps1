# Remove leftover Kuamini Security Client folder
# This script must be run as Administrator

$folderPath = "C:\Program Files (x86)\Kuamini Security Client"

Write-Host "Checking for leftover installation folder..." -ForegroundColor Cyan

if (-not (Test-Path $folderPath)) {
    Write-Host "Folder does not exist. Nothing to remove." -ForegroundColor Green
    exit 0
}

Write-Host "Folder found: $folderPath" -ForegroundColor Yellow

# Stop any related processes
Write-Host "Stopping any related processes..." -ForegroundColor Cyan
Get-Process | Where-Object {$_.ProcessName -match "Kuamini|KuaminiSecurityClient|KuaminiAgentTray"} | ForEach-Object {
    Write-Host "  Stopping process: $($_.ProcessName) (PID: $($_.Id))" -ForegroundColor Yellow
    Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
}

Start-Sleep -Seconds 2

# Try to remove the folder
Write-Host "Attempting to remove folder..." -ForegroundColor Cyan

try {
    # Take ownership
    Write-Host "Taking ownership of folder..." -ForegroundColor Cyan
    $takeownResult = takeown /F $folderPath /R /D Y 2>&1
    
    # Grant full permissions
    Write-Host "Granting permissions..." -ForegroundColor Cyan
    $icaclsResult = icacls $folderPath /grant "$(whoami):F" /T /C /Q 2>&1
    
    # Remove the folder
    Write-Host "Removing folder..." -ForegroundColor Cyan
    Remove-Item -Path $folderPath -Recurse -Force -ErrorAction Stop
    
    Write-Host "Successfully removed: $folderPath" -ForegroundColor Green
} catch {
    Write-Host "Error removing folder: $_" -ForegroundColor Red
    Write-Host "`nIf the error persists, try these steps:" -ForegroundColor Yellow
    Write-Host "1. Restart your computer to release any file locks" -ForegroundColor Yellow
    Write-Host "2. Run this script again as Administrator" -ForegroundColor Yellow
    Write-Host "3. Manually delete the folder using File Explorer (may require Safe Mode)" -ForegroundColor Yellow
    exit 1
}

# Verify removal
if (Test-Path $folderPath) {
    Write-Host "Warning: Folder still exists after removal attempt!" -ForegroundColor Red
    exit 1
} else {
    Write-Host "Verification: Folder successfully removed!" -ForegroundColor Green
    exit 0
}
