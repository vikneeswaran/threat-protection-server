Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Set-Location (Join-Path $PSScriptRoot "..")

if (-not (Test-Path "dist\KuaminiSecurityClient")) {
    Write-Error "dist\KuaminiSecurityClient not found. Run pyinstaller-win.ps1 first."
    exit 1
}

Set-Location dist
Compress-Archive -Path "KuaminiSecurityClient" -DestinationPath "windows.zip" -Force
Write-Host "Created: dist\windows.zip"
