param(
    [Parameter(Mandatory = $false)]
    [string]$RegistrationToken = "placeholder-token",

    [Parameter(Mandatory = $false)]
    [string]$AccountId = "",

    [Parameter(Mandatory = $false)]
    [string]$AccountName = "",

    [Parameter(Mandatory = $false)]
    [string]$Version = ""
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$agentDir = Split-Path -Parent $scriptDir
$projectRoot = Split-Path -Parent $agentDir
$distDir = Join-Path $agentDir "dist\KuaminiSecurityClient"
$internalDir = Join-Path $distDir "_internal"
$configTemplate = Join-Path $agentDir "config.json"
$configTemp = Join-Path $scriptDir "config-temp.json"
$internalWxs = Join-Path $scriptDir "InternalFiles.wxs"
$wxsMain = Join-Path $scriptDir "KuaminiSecurityClient.wxs"
$exePath = Join-Path $distDir "KuaminiSecurityClient.exe"
$registrationMetaFile = Join-Path $distDir "registration.json"
$heatPath = "C:\Program Files (x86)\WiX Toolset v3.14\bin\heat.exe"
$candlePath = "C:\Program Files (x86)\WiX Toolset v3.14\bin\candle.exe"
$lightPath = "C:\Program Files (x86)\WiX Toolset v3.14\bin\light.exe"
$objDir = Join-Path $scriptDir "obj"
$publicTrayDir = Join-Path $projectRoot "public\tray"

function Get-NextVersion {
    param(
        [string[]]$SearchDirs
    )

    $regex = [regex]'^KuaminiSecurityClient-(\d+\.\d+\.\d+(?:\.\d+)?)\.msi$'
    $versions = @()

    foreach ($dir in $SearchDirs) {
        if (-not (Test-Path $dir)) { continue }
        Get-ChildItem -Path $dir -File -ErrorAction SilentlyContinue | ForEach-Object {
            $m = $regex.Match($_.Name)
            if ($m.Success) {
                $parts = $m.Groups[1].Value.Split('.') | ForEach-Object { [int]$_ }
                $versions += ,@($parts)
            }
        }
    }

    if ($versions.Count -eq 0) {
        return "1.0.0"
    }

    $max = $versions |
        Sort-Object @{Expression = { $_[0] }}, @{Expression = { $_[1] }}, @{Expression = { $_[2] }}, @{Expression = { if ($_.Count -gt 3) { $_[3] } else { 0 } }} |
        Select-Object -Last 1

    while ($max.Count -lt 3) { $max += 0 }
    $max[2] = [int]$max[2] + 1
    return ($max -join '.')
}

if ([string]::IsNullOrWhiteSpace($Version)) {
    $Version = Get-NextVersion -SearchDirs @($publicTrayDir, (Join-Path $agentDir "dist"))
    Write-Host "Auto-selected MSI version: $Version"
}

$versionParts = $Version.Split('.')
switch ($versionParts.Count) {
    1 { $productVersion = "$Version.0.0.0" }
    2 { $productVersion = "$Version.0.0" }
    3 { $productVersion = "$Version.0" }
    default { $productVersion = $Version }
}

$msiOutput = Join-Path $agentDir "dist\KuaminiSecurityClient-$Version.msi"

Write-Host "================================================"
Write-Host "Building MSI Installer v$Version"
Write-Host "Product Version: $productVersion"
Write-Host "================================================"

if (-not (Test-Path $exePath)) {
    Write-Host "ERROR: Executable not found at $exePath" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $configTemplate)) {
    Write-Host "ERROR: Config template not found at $configTemplate" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $internalDir)) {
    Write-Host "ERROR: _internal directory not found at $internalDir" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $heatPath)) {
    Write-Host "ERROR: Heat.exe not found at $heatPath" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $candlePath)) {
    Write-Host "ERROR: Candle.exe not found at $candlePath" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $lightPath)) {
    Write-Host "ERROR: Light.exe not found at $lightPath" -ForegroundColor Red
    exit 1
}

# The config.json template is only used for reference
# The actual MSI will not include config.json - it will be created at runtime by the app

# Clean up any old config.json from dist folder
Remove-Item (Join-Path $distDir "config.json") -Force -ErrorAction SilentlyContinue

# Registration token is provided as a sidecar file at install time
$logAccountId = "<provided at install>"
$logAgentId = "<will be generated at install>"

if (-not (Test-Path $objDir)) {
    New-Item -ItemType Directory -Path $objDir | Out-Null
}

& $heatPath dir $internalDir -cg InternalFiles -gg -dr INTERNALFOLDER -sf -srd -o $internalWxs
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Heat.exe failed" -ForegroundColor Red
    exit 1
}

# Ensure generated components are marked as 64-bit
try {
    $wxsContent = Get-Content -Path $internalWxs -Raw
    $wxsContent = $wxsContent -replace '<Component\s+', '<Component Win64="yes" '
    Set-Content -Path $internalWxs -Value $wxsContent -Encoding UTF8
} catch {
    Write-Host "WARNING: Failed to mark InternalFiles components as Win64" -ForegroundColor Yellow
}

& $candlePath "-dProductVersion=$productVersion" "-dSourceDir=$distDir" -out "$objDir\" $wxsMain
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Candle.exe failed for KuaminiSecurityClient.wxs" -ForegroundColor Red
    exit 1
}

& $candlePath -out "$objDir\" $internalWxs
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Candle.exe failed for InternalFiles.wxs" -ForegroundColor Red
    exit 1
}

& $lightPath -out $msiOutput `
    -b $internalDir `
    (Join-Path $objDir "KuaminiSecurityClient.wixobj") `
    (Join-Path $objDir "InternalFiles.wixobj") `
    -ext WixUIExtension
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Light.exe failed" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $msiOutput)) {
    Write-Host "ERROR: MSI was not created at $msiOutput" -ForegroundColor Red
    exit 1
}

if (Test-Path $publicTrayDir) {
    Copy-Item $msiOutput (Join-Path $publicTrayDir "KuaminiSecurityClient-$Version.msi") -Force
}

Remove-Item $configTemp -Force -ErrorAction SilentlyContinue

Write-Host "Build completed successfully"
Write-Host "MSI: $msiOutput"
Write-Host "Account ID (from token): $logAccountId"
Write-Host "Agent ID: $logAgentId (will be generated on first app run)"
