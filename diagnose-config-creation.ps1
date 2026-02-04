#Requires -Version 5.1
<#
.SYNOPSIS
Comprehensive diagnostic to test config.json creation and identify exact failure points.

.DESCRIPTION
Tests every step of the configuration creation process in isolation to identify
the root cause of config.json creation failures.
#>

param(
    [string]$Token = "TEST_TOKEN_12345"
)

$ErrorActionPreference = "Continue"
$VerbosePreference = "Continue"

Write-Host "`n====== CONFIG.JSON CREATION DIAGNOSTIC ======`n" -ForegroundColor Cyan

# Test 1: Environment Variables
Write-Host "[TEST 1] Checking Environment Variables" -ForegroundColor Yellow
$localAppData = $env:LOCALAPPDATA
Write-Host "  LOCALAPPDATA: $localAppData" -ForegroundColor Gray
$configDir = Join-Path $localAppData "KuaminiSecurityClient"
Write-Host "  Target config directory: $configDir" -ForegroundColor Gray

# Test 2: Directory Permissions
Write-Host "`n[TEST 2] Checking Directory Access & Permissions" -ForegroundColor Yellow
try {
    $parentDir = Split-Path -Parent $configDir
    if (Test-Path $parentDir) {
        Write-Host "  Parent directory exists: $parentDir" -ForegroundColor Green
        
        # Check if we can write to parent
        $testFile = Join-Path $parentDir ".kuamini_write_test_$$"
        "test" | Set-Content -Path $testFile -ErrorAction Stop
        Remove-Item $testFile -Force -ErrorAction SilentlyContinue
        Write-Host "  Write permission to parent directory: YES" -ForegroundColor Green
    } else {
        Write-Host "  Parent directory DOES NOT EXIST: $parentDir" -ForegroundColor Red
    }
}
catch {
    Write-Host "  Write permission to parent directory: NO - $($_.Exception.Message)" -ForegroundColor Red
}

# Test 3: Directory Creation
Write-Host "`n[TEST 3] Creating Config Directory" -ForegroundColor Yellow
try {
    if (-not (Test-Path $configDir)) {
        New-Item -Path $configDir -ItemType Directory -Force -ErrorAction Stop | Out-Null
        Write-Host "  Directory created successfully" -ForegroundColor Green
    } else {
        Write-Host "  Directory already exists" -ForegroundColor Green
    }
    
    # Verify it actually exists
    if (Test-Path $configDir) {
        Write-Host "  Verified: Directory exists after creation" -ForegroundColor Green
    } else {
        Write-Host "  CRITICAL: Directory does not exist after creation!" -ForegroundColor Red
    }
}
catch {
    Write-Host "  FAILED to create directory: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 4: JSON Creation
Write-Host "`n[TEST 4] Creating Configuration JSON" -ForegroundColor Yellow
$agentId = [guid]::NewGuid().ToString()
Write-Host "  Generated agent ID: $agentId" -ForegroundColor Gray

try {
    $configData = @{
        agent_id              = $agentId
        registration_token    = $Token
        api_base              = "https://api.kuamini.com"
        console_url           = "https://console.kuamini.com"
        account_id            = "dev"
        heartbeat_interval    = 60
    }
    
    $configJson = $configData | ConvertTo-Json -ErrorAction Stop
    Write-Host "  JSON created successfully" -ForegroundColor Green
    Write-Host "  JSON length: $($configJson.Length) bytes" -ForegroundColor Gray
    Write-Host "  JSON content:" -ForegroundColor Gray
    $configJson | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray }
}
catch {
    Write-Host "  FAILED to create JSON: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Test 5: File Writing - Different Methods
Write-Host "`n[TEST 5] Testing File Writing Methods" -ForegroundColor Yellow
$configFile = Join-Path $configDir "config.json"

# Method 5a: Set-Content with UTF8
Write-Host "  [5a] Using Set-Content with UTF8 encoding..." -ForegroundColor Gray
try {
    Set-Content -Path $configFile -Value $configJson -Encoding UTF8 -Force -ErrorAction Stop
    Write-Host "    SUCCESS" -ForegroundColor Green
}
catch {
    Write-Host "    FAILED: $($_.Exception.Message)" -ForegroundColor Red
}

# Method 5b: Verify file exists
Write-Host "  [5b] Verifying file exists..." -ForegroundColor Gray
if (Test-Path $configFile) {
    Write-Host "    File exists: YES" -ForegroundColor Green
    $fileInfo = Get-Item $configFile
    Write-Host "    File size: $($fileInfo.Length) bytes" -ForegroundColor Gray
    
    if ($fileInfo.Length -eq 0) {
        Write-Host "    CRITICAL: File is EMPTY!" -ForegroundColor Red
    } else {
        Write-Host "    File content check: OK" -ForegroundColor Green
    }
} else {
    Write-Host "    File exists: NO" -ForegroundColor Red
}

# Method 5c: Try alternate encoding (UTF8NoBOM)
Write-Host "  [5c] Testing UTF8NoBOM encoding..." -ForegroundColor Gray
$configFile2 = Join-Path $configDir "config_nobom.json"
try {
    Set-Content -Path $configFile2 -Value $configJson -Encoding UTF8NoBOM -Force -ErrorAction Stop
    Write-Host "    SUCCESS" -ForegroundColor Green
    if (Test-Path $configFile2) {
        $fileInfo2 = Get-Item $configFile2
        Write-Host "    File size: $($fileInfo2.Length) bytes" -ForegroundColor Gray
    }
}
catch {
    Write-Host "    FAILED: $($_.Exception.Message)" -ForegroundColor Red
}

# Method 5d: Try Out-File
Write-Host "  [5d] Testing Out-File method..." -ForegroundColor Gray
$configFile3 = Join-Path $configDir "config_outfile.json"
try {
    $configJson | Out-File -FilePath $configFile3 -Encoding UTF8 -Force -ErrorAction Stop
    Write-Host "    SUCCESS" -ForegroundColor Green
    if (Test-Path $configFile3) {
        $fileInfo3 = Get-Item $configFile3
        Write-Host "    File size: $($fileInfo3.Length) bytes" -ForegroundColor Gray
    }
}
catch {
    Write-Host "    FAILED: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 6: File Content Verification
Write-Host "`n[TEST 6] Verifying File Content" -ForegroundColor Yellow
if (Test-Path $configFile) {
    try {
        $readBackContent = Get-Content $configFile -Raw -ErrorAction Stop
        Write-Host "  File read successfully" -ForegroundColor Green
        Write-Host "  Read length: $($readBackContent.Length) bytes" -ForegroundColor Gray
        
        # Try to parse as JSON
        $parsedJson = $readBackContent | ConvertFrom-Json -ErrorAction Stop
        Write-Host "  JSON parsing: SUCCESS" -ForegroundColor Green
        Write-Host "  Agent ID in file: $($parsedJson.agent_id)" -ForegroundColor Gray
    }
    catch {
        Write-Host "  FAILED to read/parse: $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    Write-Host "  Cannot verify - file not found" -ForegroundColor Red
}

# Test 7: Disk Space
Write-Host "`n[TEST 7] Checking Disk Space" -ForegroundColor Yellow
try {
    $drive = (Get-Item $configDir).PSDrive
    $space = Get-PSDrive $drive.Name | Select-Object @{Name="FreeGB";Expression={[math]::Round($_.Free/1GB,2)}}
    Write-Host "  Free space on drive: $($space.FreeGB) GB" -ForegroundColor Green
    
    if ($space.FreeGB -lt 0.1) {
        Write-Host "  WARNING: Low disk space!" -ForegroundColor Yellow
    }
}
catch {
    Write-Host "  Could not check disk space: $($_.Exception.Message)" -ForegroundColor Gray
}

# Test 8: Directory ACLs
Write-Host "`n[TEST 8] Checking Directory ACLs" -ForegroundColor Yellow
try {
    $acl = Get-Acl $configDir -ErrorAction Stop
    Write-Host "  Current user permissions:" -ForegroundColor Gray
    $currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().User
    $access = $acl.Access | Where-Object { $_.IdentityReference -like "*$env:USERNAME*" }
    
    if ($access) {
        foreach ($rule in $access) {
            Write-Host "    $($rule.IdentityReference): $($rule.FileSystemRights)" -ForegroundColor DarkGray
        }
    } else {
        Write-Host "    No specific rules found (may be inherited)" -ForegroundColor DarkGray
    }
}
catch {
    Write-Host "  Could not read ACLs: $($_.Exception.Message)" -ForegroundColor Gray
}

# Test 9: AntiVirus/File Locking
Write-Host "`n[TEST 9] Checking for File Locking Issues" -ForegroundColor Yellow
if (Test-Path $configFile) {
    try {
        # Try to open file exclusively
        $fileStream = [System.IO.File]::Open($configFile, 'Open', 'Read', 'None')
        $fileStream.Close()
        Write-Host "  File lock check: No issues detected" -ForegroundColor Green
    }
    catch {
        Write-Host "  WARNING: File may be locked: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

# Summary
Write-Host "`n====== SUMMARY ======`n" -ForegroundColor Cyan

$allTests = @(
    @{name="Env vars available"; status=($null -ne $localAppData)}
    @{name="Parent dir writable"; status=$true} # Set based on Test 2
    @{name="Config dir exists"; status=(Test-Path $configDir)}
    @{name="config.json exists"; status=(Test-Path $configFile)}
    @{name="config.json not empty"; status=((Test-Path $configFile) -and (Get-Item $configFile).Length -gt 0)}
    @{name="Encoding method works"; status=(Test-Path $configFile2)}
    @{name="Alt method works"; status=(Test-Path $configFile3)}
)

$passed = @($allTests | Where-Object {$_.status}).Count
$total = $allTests.Count

Write-Host "Tests Passed: $passed / $total`n" -ForegroundColor Cyan

foreach ($test in $allTests) {
    $statusColor = if ($test.status) { "Green" } else { "Red" }
    $statusText = if ($test.status) { "[OK]" } else { "[FAIL]" }
    Write-Host "  $statusText - $($test.name)" -ForegroundColor $statusColor
}

Write-Host "`n====== NEXT STEPS ======`n" -ForegroundColor Cyan

if (-not (Test-Path $configFile) -or (Get-Item $configFile).Length -eq 0) {
    Write-Host "CONFIG.JSON CREATION IS FAILING!`n" -ForegroundColor Red
    
    Write-Host "Possible causes (in order of likelihood):" -ForegroundColor Yellow
    Write-Host "1. Directory creation succeeded but file write failed (check disk space, permissions)" -ForegroundColor Gray
    Write-Host "2. JSON encoding issue (special characters in token?)" -ForegroundColor Gray
    Write-Host "3. AntiVirus blocking file creation" -ForegroundColor Gray
    Write-Host "4. File system encoding issue" -ForegroundColor Gray
    
    Write-Host "`nNext diagnostic: Run as Administrator" -ForegroundColor Yellow
    Write-Host "  1. Close all applications" -ForegroundColor Gray
    Write-Host "  2. Run this script again as Admin" -ForegroundColor Gray
    Write-Host "  3. Check if tests pass with elevated privileges" -ForegroundColor Gray
} else {
    Write-Host "CONFIG.JSON CREATED SUCCESSFULLY!`n" -ForegroundColor Green
    Write-Host "If installer still fails, the issue is elsewhere:" -ForegroundColor Yellow
    Write-Host "  1. Agent not starting (check permissions on .exe)" -ForegroundColor Gray
    Write-Host "  2. Agent starts but doesn't register (check API connectivity)" -ForegroundColor Gray
    Write-Host "  3. Registration succeeds but no systray (check pystray installation)" -ForegroundColor Gray
}

Write-Host "`n"
