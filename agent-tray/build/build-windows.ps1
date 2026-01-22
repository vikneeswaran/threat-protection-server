# PowerShell script to build Windows executable using PyInstaller
# Creates a standalone executable in dist/KuaminiSecurityClient/

param(
    [string]$SourceDir,
    [string]$OutputDir
)

$ErrorActionPreference = "Stop"

# Set defaults if not provided
if (-not $SourceDir) {
    $tempPath = Resolve-Path "$PSScriptRoot\..\.." -ErrorAction SilentlyContinue
    if ($tempPath) {
        $SourceDir = $tempPath.Path
    } else {
        $SourceDir = $PSScriptRoot
    }
}
if (-not $OutputDir) {
    $OutputDir = "$SourceDir\agent-tray\dist"
}

$AgentTrayDir = "$SourceDir\agent-tray"
$SpecFile = "$AgentTrayDir\KuaminiSecurityClient-win.spec"
$DistDir = "$AgentTrayDir\dist"
$BuildDir = "$AgentTrayDir\build"

Write-Host "Building Kuamini Security Client for Windows..." -ForegroundColor Cyan
Write-Host "  Source: $AgentTrayDir" -ForegroundColor Gray
Write-Host "  Spec: $SpecFile" -ForegroundColor Gray

# Check if PyInstaller is installed
try {
    $pyinstallerVersion = & python -m PyInstaller --version 2>&1
    Write-Host "PyInstaller version: $pyinstallerVersion" -ForegroundColor Green
} catch {
    Write-Host "PyInstaller not found, installing..." -ForegroundColor Yellow
    & python -m pip install --upgrade pip
    & python -m pip install pyinstaller
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to install PyInstaller"
        exit 1
    }
}

# Verify spec file exists
if (-not (Test-Path $SpecFile)) {
    Write-Error "Spec file not found: $SpecFile"
    exit 1
}

# Clean previous build
Write-Host "Cleaning previous build..." -ForegroundColor Cyan
if (Test-Path "$DistDir\KuaminiSecurityClient") {
    Remove-Item -Path "$DistDir\KuaminiSecurityClient" -Recurse -Force -ErrorAction SilentlyContinue
}
if (Test-Path "$BuildDir\KuaminiSecurityClient") {
    Remove-Item -Path "$BuildDir\KuaminiSecurityClient" -Recurse -Force -ErrorAction SilentlyContinue
}

# Build with PyInstaller
Write-Host "Running PyInstaller..." -ForegroundColor Cyan
Push-Location $AgentTrayDir
try {
    & python -m PyInstaller --clean $SpecFile
    if ($LASTEXITCODE -ne 0) {
        Write-Error "PyInstaller build failed"
        exit 1
    }
} finally {
    Pop-Location
}

# Verify output
$ExePath = "$DistDir\KuaminiSecurityClient\KuaminiSecurityClient.exe"
if (-not (Test-Path $ExePath)) {
    Write-Error "Build failed: Executable not found at $ExePath"
    exit 1
}

$fileSize = (Get-Item $ExePath).Length / 1MB
Write-Host "Build successful!" -ForegroundColor Green
Write-Host "  Executable: $ExePath" -ForegroundColor Green
Write-Host "  Size: $([math]::Round($fileSize, 2)) MB" -ForegroundColor Green

# Create ZIP package
Write-Host "Creating ZIP package..." -ForegroundColor Cyan
$ZipPath = "$SourceDir\public\tray\windows.zip"
$PublicTrayDir = "$SourceDir\public\tray"

# Ensure public/tray directory exists
if (-not (Test-Path $PublicTrayDir)) {
    New-Item -ItemType Directory -Path $PublicTrayDir -Force | Out-Null
}

# Remove old ZIP if exists
if (Test-Path $ZipPath) {
    Remove-Item $ZipPath -Force
}

# Create ZIP from dist folder
Compress-Archive -Path "$DistDir\KuaminiSecurityClient\*" -DestinationPath $ZipPath -Force

if (Test-Path $ZipPath) {
    $zipSize = (Get-Item $ZipPath).Length / 1MB
    Write-Host "ZIP package created!" -ForegroundColor Green
    Write-Host "  Location: $ZipPath" -ForegroundColor Green
    Write-Host "  Size: $([math]::Round($zipSize, 2)) MB" -ForegroundColor Green
} else {
    Write-Error "Failed to create ZIP package"
    exit 1
}

Write-Host "`nWindows build completed successfully!" -ForegroundColor Green
