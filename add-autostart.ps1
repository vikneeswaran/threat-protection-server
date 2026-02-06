# Add Kuamini Security Client to Windows auto-start
# Run this script as Administrator if auto-start wasn't created during installation

$exePath = "C:\Program Files\Kuamini Security Client\KuaminiSecurityClient.exe"
$registryPath = "HKLM:\Software\Microsoft\Windows\CurrentVersion\Run"
$name = "KuaminiSecurityClient"

# Check if executable exists
if (-not (Test-Path $exePath)) {
    Write-Host "ERROR: Kuamini Security Client not found at: $exePath" -ForegroundColor Red
    Write-Host "Please verify the installation path." -ForegroundColor Yellow
    exit 1
}

# Add registry entry
try {
    Set-ItemProperty -Path $registryPath -Name $name -Value "`"$exePath`"" -Type String -Force
    Write-Host "SUCCESS: Auto-start entry created!" -ForegroundColor Green
    Write-Host "The client will now start automatically when Windows boots." -ForegroundColor Cyan
    
    # Verify
    $value = Get-ItemProperty -Path $registryPath -Name $name -ErrorAction SilentlyContinue
    if ($value) {
        Write-Host "`nVerified: $name = $($value.$name)" -ForegroundColor Gray
    }
} catch {
    Write-Host "ERROR: Failed to create registry entry: $_" -ForegroundColor Red
    Write-Host "Make sure you're running this script as Administrator." -ForegroundColor Yellow
    exit 1
}
