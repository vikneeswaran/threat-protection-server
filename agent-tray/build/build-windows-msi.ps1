# Windows MSI Installer Builder for Kuamini Security Client
# This script creates a Windows MSI installer package

$ErrorActionPreference = "Stop"

Write-Host "===== Building Windows MSI Installer =====" -ForegroundColor Cyan

# Configuration
$APP_NAME = "KuaminiSecurityClient"
$VERSION = "1.0.0"
$MANUFACTURER = "Kuamini Systems"
$DIST_DIR = Join-Path $PSScriptRoot "..\dist"
$BUILD_DIR = Join-Path $PSScriptRoot "."
$EXE_DIR = Join-Path $DIST_DIR $APP_NAME

# Check if dist/KuaminiSecurityClient exists
if (-not (Test-Path $EXE_DIR)) {
    Write-Host "ERROR: $EXE_DIR not found. Run PyInstaller first!" -ForegroundColor Red
    exit 1
}

Write-Host "[OK] Found executable directory: $EXE_DIR" -ForegroundColor Green

# Create WiX source file
$WXS_FILE = Join-Path $BUILD_DIR "$APP_NAME.wxs"

Write-Host "Creating WiX source file..." -ForegroundColor Yellow

# Generate component IDs for all files in dist
$components = @()
$fileId = 1

Get-ChildItem -Path $EXE_DIR -Recurse -File | ForEach-Object {
    $relativePath = $_.FullName.Substring($EXE_DIR.Length + 1)
    $componentId = "Component$fileId"
    $fileIdStr = "File$fileId"
    
    $components += @"
      <Component Id="$componentId" Guid="*">
        <File Id="$fileIdStr" Source="$($_.FullName)" KeyPath="yes" />
      </Component>
"@
    $fileId++
}

$wxsContent = @"
<?xml version="1.0" encoding="UTF-8"?>
<Wix xmlns="http://schemas.microsoft.com/wix/2006/wi">
  <Product Id="*" Name="$APP_NAME" Language="1033" Version="$VERSION" 
           Manufacturer="$MANUFACTURER" UpgradeCode="12345678-1234-1234-1234-123456789012">
    
    <Package InstallerVersion="200" Compressed="yes" InstallScope="perMachine" />
    
    <MajorUpgrade DowngradeErrorMessage="A newer version is already installed." />
    
    <MediaTemplate EmbedCab="yes" />

    <Feature Id="ProductFeature" Title="$APP_NAME" Level="1">
      <ComponentGroupRef Id="ProductComponents" />
    </Feature>
    
    <Directory Id="TARGETDIR" Name="SourceDir">
      <Directory Id="ProgramFilesFolder">
        <Directory Id="INSTALLFOLDER" Name="$APP_NAME" />
      </Directory>
    </Directory>

    <ComponentGroup Id="ProductComponents" Directory="INSTALLFOLDER">
$($components -join "`r`n")
    </ComponentGroup>
  </Product>
</Wix>
"@

$wxsContent | Out-File -FilePath $WXS_FILE -Encoding UTF8

Write-Host "[OK] Created WiX source file" -ForegroundColor Green

# Build MSI using WiX
Write-Host "Compiling with candle.exe..." -ForegroundColor Yellow

$WIXOBJ = Join-Path $BUILD_DIR "$APP_NAME.wixobj"

# Try to find candle.exe in PATH first, then common locations
$candleExe = Get-Command candle.exe -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source
if (-not $candleExe) {
    $possiblePaths = @(
        "C:\Program Files (x86)\WiX Toolset v3.11\bin\candle.exe",
        "C:\Program Files (x86)\WiX Toolset v3.14\bin\candle.exe",
        "C:\Program Files\WiX Toolset v3.11\bin\candle.exe",
        "C:\Program Files\WiX Toolset v3.14\bin\candle.exe"
    )
    foreach ($path in $possiblePaths) {
        if (Test-Path $path) {
            $candleExe = $path
            break
        }
    }
}

if (-not $candleExe) {
    Write-Host "ERROR: candle.exe not found. Is WiX Toolset installed?" -ForegroundColor Red
    exit 1
}

Write-Host "Using candle.exe: $candleExe" -ForegroundColor Gray
& $candleExe $WXS_FILE -out $WIXOBJ

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: candle.exe failed" -ForegroundColor Red
    exit 1
}

Write-Host "[OK] Compiled WiX object file" -ForegroundColor Green

Write-Host "Linking with light.exe..." -ForegroundColor Yellow

$MSI_FILE = Join-Path $DIST_DIR "$APP_NAME-$VERSION.msi"

# Find light.exe
$lightExe = Get-Command light.exe -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source
if (-not $lightExe) {
    $lightExe = Join-Path (Split-Path $candleExe) "light.exe"
}

Write-Host "Using light.exe: $lightExe" -ForegroundColor Gray
& $lightExe $WIXOBJ -out $MSI_FILE -sice:ICE64 -sice:ICE69

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: light.exe failed" -ForegroundColor Red
    exit 1
}

Write-Host "[OK] Created MSI installer" -ForegroundColor Green

# Cleanup
Remove-Item $WXS_FILE -ErrorAction SilentlyContinue
Remove-Item $WIXOBJ -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "===== Build Complete! =====" -ForegroundColor Green
Write-Host "MSI Installer: $MSI_FILE" -ForegroundColor Cyan
Write-Host "Size: $((Get-Item $MSI_FILE).Length / 1MB) MB" -ForegroundColor Cyan
