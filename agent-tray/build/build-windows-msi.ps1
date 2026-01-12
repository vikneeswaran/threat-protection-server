# Windows MSI Installer Builder (PowerShell)
# Requires WiX Toolset to be installed
# Install with: choco install wixtoolset

param(
    [string]$AppVersion = "1.0.0"
)

$ErrorActionPreference = "Stop"

# Verify PyInstaller output exists
$AppDir = "dist/KuaminiSecurityClient"
if (-not (Test-Path "$AppDir/KuaminiSecurityClient.exe")) {
    Write-Error "Error: $AppDir/KuaminiSecurityClient.exe not found. Run PyInstaller first."
    exit 1
}

Write-Host "=== Building Windows MSI Installer ==="
Write-Host "Version: $AppVersion"
Write-Host "App directory: $AppDir"
Write-Host ""

### Locate WiX toolset binaries if not on PATH
$heat = Get-Command heat.exe -ErrorAction SilentlyContinue
$candle = Get-Command candle.exe -ErrorAction SilentlyContinue
$light = Get-Command light.exe -ErrorAction SilentlyContinue

if (-not ($heat -and $candle -and $light)) {
  # Try to find WiX under Program Files
  $wixBin = Get-ChildItem -Path "C:\Program Files*" -Recurse -ErrorAction SilentlyContinue -Filter "candle.exe" |
    Select-Object -First 1 -ExpandProperty DirectoryName
  if ($wixBin) {
    $env:PATH = "$wixBin;" + $env:PATH
    $heat = Get-Command heat.exe -ErrorAction SilentlyContinue
    $candle = Get-Command candle.exe -ErrorAction SilentlyContinue
    $light = Get-Command light.exe -ErrorAction SilentlyContinue
  }
}

# Generate GUIDs for WiX
$ProductCode = [guid]::NewGuid().ToString()
$StartMenuGuid = [guid]::NewGuid().ToString()

# Create WiX source file (keep minimal to avoid missing-asset failures)
# Use string interpolation instead of WiX preprocessor variables to avoid PowerShell expansion issues
$WixSource = @"
<?xml version="1.0" encoding="UTF-8"?>
<Wix xmlns="http://schemas.microsoft.com/wix/2006/wi"
     xmlns:util="http://schemas.microsoft.com/wix/UtilExtension">
  <Product Id="*" Name="Kuamini Security Client" Language="1033" Version="$AppVersion" 
           Manufacturer="Kuamini Systems" UpgradeCode="6F69F6B9-F84B-48C9-9BD2-C4B5C5D5E5F5">
    <Package InstallerVersion="200" Compressed="yes" InstallScope="perMachine" />
    <MajorUpgrade DowngradeErrorMessage="A newer version of Kuamini Security Client is already installed." />
    
    <Media Id="1" Cabinet="KuaminiSecurityClient.cab" EmbedCab="yes" />

    <Feature Id="ProductFeature" Title="Kuamini Security Client" Level="1">
      <ComponentRef Id="ApplicationFiles" />
    <ComponentRef Id="StartMenuShortcut" />
    </Feature>

    <UIRef Id="WixUI_Minimal" />
    <UIRef Id="WixUI_ErrorProgressText" />

    <Directory Id="TARGETDIR" Name="SourceDir">
      <Directory Id="ProgramFilesFolder">
        <Directory Id="INSTALLFOLDER" Name="Kuamini Security Client" />
      </Directory>
      <Directory Id="ProgramMenuFolder">
        <Directory Id="ApplicationProgramsFolder" Name="Kuamini Security Client" />
      </Directory>
    </Directory>

    <DirectoryRef Id="INSTALLFOLDER">
      <Component Id="ApplicationFiles" Guid="$ProductCode">
        <File Id="MainExe" Name="KuaminiSecurityClient.exe" DiskId="1" Source="dist\KuaminiSecurityClient\KuaminiSecurityClient.exe" KeyPath="yes" />
      </Component>
    </DirectoryRef>

    <DirectoryRef Id="ApplicationProgramsFolder">
      <Component Id="StartMenuShortcut" Guid="$StartMenuGuid">
        <Shortcut Id="ApplicationStartMenuShortcut" Name="Kuamini Security Client" 
                  Description="Kuamini Security Client" Target="[INSTALLFOLDER]KuaminiSecurityClient.exe" />
        <RemoveFolder Id="RemoveApplicationProgramsFolder" On="uninstall" />
        <RegistryValue Root="HKCU" Key="Software\Kuamini\SecurityClient" Name="StartMenuShortcutInstalled" Type="integer" Value="1" KeyPath="yes" />
      </Component>
    </DirectoryRef>

  </Product>
</Wix>
"@

# Save WiX source
$WixSource | Out-File -Encoding UTF8 -FilePath "build\KuaminiSecurityClient.wxs"

Write-Host "Creating WiX project file..."
Write-Host "Generated ProductCode: $ProductCode"
Write-Host "Generated StartMenuGuid: $StartMenuGuid"

if (-not ($heat -and $candle -and $light)) {
    Write-Host ""
    Write-Host "⚠️  WiX Toolset not found!"
    Write-Host ""
    Write-Host "To build the MSI installer, install WiX Toolset:"
    Write-Host "  choco install wixtoolset --no-progress -y"
    Write-Host ""
    Write-Host "Or download from: https://wixtoolset.org/releases/"
    Write-Host ""
    Write-Host "After installing, run this script again."
    exit 1
}

Write-Host "WiX Toolset found. Building..."
Write-Host ""

# Compile WiX
Write-Host "Compiling WiX source..."
& $candle.Path -out build\ `
             build\KuaminiSecurityClient.wxs

# Link to create MSI
Write-Host "Linking to create MSI..."
& $light.Path -out dist\KuaminiSecurityClient-1.0.0.msi `
           -ext WixUIExtension `
           -ext WixUtilExtension `
           build\KuaminiSecurityClient.wixobj

Write-Host ""
Write-Host "✅ Built installer: dist\KuaminiSecurityClient-1.0.0.msi"
Get-Item dist\KuaminiSecurityClient-1.0.0.msi | Format-List FullName, Length
