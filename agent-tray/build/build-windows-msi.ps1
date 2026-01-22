# PowerShell script to build Windows MSI installer using WiX Toolset
# Prerequisites: WiX Toolset 3.14+ installed and in PATH
# This script compiles the WiX source and links the MSI package

param(
    [string]$SourceDir,
    [string]$OutputDir,
    [string]$Version = "1.0.0"
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

# Verify WiX Toolset is installed
try {
    Get-Command candle -ErrorAction Stop | Out-Null
    Get-Command light -ErrorAction Stop | Out-Null
    Write-Host "WiX Toolset found" -ForegroundColor Green
} catch {
    Write-Error "WiX Toolset not found. Please install WiX Toolset 3.14 or later and add it to PATH"
    exit 1
}

# Verify source files exist
$wxsFile = "$PSScriptRoot\KuaminiSecurityClient.wxs"
$exeFile = "$SourceDir\agent-tray\dist\KuaminiSecurityClient\KuaminiSecurityClient.exe"
$configFile = "$SourceDir\agent-tray\config.json"

if (-not (Test-Path $wxsFile)) {
    Write-Error "WiX source file not found: $wxsFile"
    exit 1
}

if (-not (Test-Path $exeFile)) {
    Write-Error "Executable not found: $exeFile"
    exit 1
}

if (-not (Test-Path $configFile)) {
    Write-Error "Config file not found: $configFile"
    exit 1
}

Write-Host "Building Kuamini Security Client MSI Installer..." -ForegroundColor Cyan
Write-Host "Source files verified" -ForegroundColor Green

# Create output directory if it doesn't exist
if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

# Compile WiX source to .wixobj
Write-Host "Compiling WiX source..." -ForegroundColor Cyan
$wixObj = "$PSScriptRoot\KuaminiSecurityClient.wixobj"
$candleArgs = @(
    $wxsFile,
    "-out", $wixObj,
    ("-dSourceDir=" + $SourceDir),
    ("-dVersion=" + $Version)
)

& candle @candleArgs
if ($LASTEXITCODE -ne 0) {
    Write-Error "Candle compilation failed"
    exit 1
}
Write-Host "WiX compilation successful" -ForegroundColor Green

# Link to create MSI
Write-Host "Linking MSI package..." -ForegroundColor Cyan
$msiFile = "$OutputDir\KuaminiSecurityClient-$Version.msi"
$lightArgs = @(
    $wixObj,
    "-out", $msiFile,
    "-ext", "WixUIExtension",
    "-cultures:en-us"
)

& light @lightArgs
if ($LASTEXITCODE -ne 0) {
    Write-Error "Light linking failed"
    exit 1
}
Write-Host "MSI linking successful" -ForegroundColor Green

# Verify MSI was created
if (Test-Path $msiFile) {
    $fileSize = (Get-Item $msiFile).Length / 1MB
    Write-Host ("MSI created successfully: " + $msiFile) -ForegroundColor Green
    $sizeStr = [Math]::Round($fileSize, 2)
    Write-Host ("File size: " + $sizeStr + " MB") -ForegroundColor Green
    
    # Copy to public/tray directory
    $publicPath = "$PSScriptRoot\..\..\public\tray\KuaminiSecurityClient-$Version.msi"
    Copy-Item $msiFile $publicPath -Force
    Write-Host ("MSI copied to: " + $publicPath) -ForegroundColor Green
} else {
    Write-Error "MSI file was not created"
    exit 1
}

# Clean up temporary files
Remove-Item $wixObj -ErrorAction SilentlyContinue
Write-Host "Build completed successfully!" -ForegroundColor Green
