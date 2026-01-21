# Force-clean Kuamini installer entries from registry
# Run this AS ADMINISTRATOR in PowerShell

$regPaths = @(
    'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall',
    'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall'
)

Write-Host "Searching for Kuamini entries..." -ForegroundColor Cyan

foreach ($regPath in $regPaths) {
    if (Test-Path $regPath) {
        Get-ChildItem $regPath | Where-Object { (Get-ItemProperty $_).DisplayName -like '*Kuamini*' } | ForEach-Object {
            $displayName = (Get-ItemProperty $_).DisplayName
            $keyPath = $_.Name
            Write-Host "Removing: $displayName" -ForegroundColor Yellow
            Write-Host "  Key: $keyPath" -ForegroundColor Gray
            
            try {
                Remove-Item $_.PSPath -Force -ErrorAction Stop
                Write-Host "  [REMOVED]" -ForegroundColor Green
            } catch {
                Write-Host "  [ERROR] $_" -ForegroundColor Red
            }
        }
    }
}

Write-Host "`nDone. Refresh Control Panel to verify." -ForegroundColor Green
