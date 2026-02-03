param(
    [Parameter(Mandatory = $true)]
    [string]$RegistrationToken,

    [Parameter(Mandatory = $false)]
    [string]$Version = "1.0.5"
)

$ErrorActionPreference = "Stop"

$versionParts = $Version.Split('.')
switch ($versionParts.Count) {
    1 { $productVersion = "$Version.0.0.0" }
    2 { $productVersion = "$Version.0.0" }
    3 { $productVersion = "$Version.0" }
    default { $productVersion = $Version }
}

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
$heatPath = "C:\Program Files (x86)\WiX Toolset v3.14\bin\heat.exe"
$candlePath = "C:\Program Files (x86)\WiX Toolset v3.14\bin\candle.exe"
$lightPath = "C:\Program Files (x86)\WiX Toolset v3.14\bin\light.exe"
$objDir = Join-Path $scriptDir "obj"
$msiOutput = Join-Path $agentDir "dist\KuaminiSecurityClient-$Version.msi"
$publicTrayDir = Join-Path $projectRoot "public\tray"

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

$config = Get-Content $configTemplate -Raw | ConvertFrom-Json
# The config.json template is only used to extract account_id from token for logging
# The actual MSI will not include config.json - it will be created at runtime by the app

# Clean up any old config.json from dist folder
Remove-Item (Join-Path $distDir "config.json") -Force -ErrorAction SilentlyContinue

# Save the embedded token to a separate file (not config.json) - app will read this on first run
$tokenFile = Join-Path $distDir "registration.token"
Set-Content $tokenFile $RegistrationToken -Encoding UTF8 -NoNewline

# Extract account_id and agent_id for logging purposes
$logAccountId = "<not yet set>"
$logAgentId = "<will be generated at install>"

if ($RegistrationToken.Length -gt 40) {
    try {
        $decoded = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($RegistrationToken))
        $tokenObj = $decoded | ConvertFrom-Json
        if ($tokenObj.accountId) {
            $logAccountId = $tokenObj.accountId
        }
    } catch {
        Write-Host "WARNING: Could not parse registration token for logging" -ForegroundColor Yellow
    }
}

if (-not (Test-Path $objDir)) {
    New-Item -ItemType Directory -Path $objDir | Out-Null
}

& $heatPath dir $internalDir -cg InternalFiles -gg -dr INTERNALFOLDER -sf -srd -o $internalWxs
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Heat.exe failed" -ForegroundColor Red
    exit 1
}

& $candlePath "-dProductVersion=$productVersion" -out "$objDir\" $wxsMain
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
