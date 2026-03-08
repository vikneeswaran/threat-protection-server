#Requires -RunAsAdministrator
<#
.SYNOPSIS
Kuamini Security Client Installer - Helper Script

This script extracts the registration token and passes it to the MSI installer.
Run this script from the extracted ZIP folder containing:
- KuaminiSecurityClient-1.0.5.msi
- registration.token

.EXAMPLE
.\install-helper.ps1
#>

param(
    [Parameter(Mandatory = $false)]
    [switch]$Quiet
)

$ErrorActionPreference = "Stop"
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path

# ============================================================================
# VALIDATE ENVIRONMENT
# ============================================================================

Write-Host "Kuamini Security Client Installer"  -ForegroundColor Green

# Check for required files
$msiPath = Join-Path $scriptPath "KuaminiSecurityClient-1.0.5.msi"
$tokenPath = Join-Path $scriptPath "registration.token"

if (!(Test-Path $msiPath)) {
    Write-Host "ERROR: MSI file not found in current directory" -ForegroundColor Red
    Write-Host "Expected: $msiPath" -ForegroundColor Red
    exit 1
}

if (!(Test-Path $tokenPath)) {
    Write-Host "ERROR: registration.token file not found in current directory" -ForegroundColor Red
    Write-Host "Expected: $tokenPath" -ForegroundColor Red
    exit 1
}

Write-Host "Found MSI: $(Split-Path -Leaf $msiPath)" -ForegroundColor Cyan
Write-Host "Found token: $(Split-Path -Leaf $tokenPath)" -ForegroundColor Cyan

# ============================================================================
# READ TOKEN
# ============================================================================

Write-Host "Reading registration token..." -ForegroundColor Yellow
$token = Get-Content $tokenPath -Raw
if (-not $token) {
    Write-Host "ERROR: registration.token is empty" -ForegroundColor Red
    exit 1
}

Write-Host "Token loaded (length: $($token.Length) bytes)" -ForegroundColor Cyan

# ============================================================================
# INSTALL MSI WITH TOKEN
# ============================================================================

Write-Host "Installing Kuamini Security Client..." -ForegroundColor Yellow
Write-Host ""

$tempLogFile = Join-Path $env:TEMP "kuamini-install-$(Get-Random).log"

try {
    # Create config directory early
    $configDir = Join-Path $env:LOCALAPPDATA "KuaminiSecurityClient"
    New-Item -ItemType Directory -Path $configDir -Force | Out-Null
    
    # Write token to installation config directory (backup location)
    $backupTokenPath = Join-Path $configDir "registration.token"
    Set-Content -Path $backupTokenPath -Value $token -Encoding UTF8 -NoNewline
    Write-Host "Token written to: $backupTokenPath" -ForegroundColor Cyan
    
    # Run MSI with token passed as property
    $processSplat = @{
        FilePath = "msiexec.exe"
        ArgumentList = @(
            "/i", $msiPath,
            "REGISTRATIONTOKEN=`"$token`"",
            "/L*V", $tempLogFile,
            "/passive"
        )
        Wait = $true
        NoNewWindow = $false
    }
    
    $process = Start-Process @processSplat -PassThru
    $exitCode = $process.ExitCode
    
    if ($exitCode -ne 0) {
        Write-Host "MSI installation failed with exit code: $exitCode" -ForegroundColor Red
        Write-Host "Log file: $tempLogFile" -ForegroundColor Yellow
        Get-Content $tempLogFile -Tail 50 | Write-Host
        exit $exitCode
    }
    
    Write-Host "MSI installation completed successfully" -ForegroundColor Green
    
    # ============================================================================
    # START AGENT IMMEDIATELY (Don't wait for reboot)
    # ============================================================================
    
    Write-Host ""
    Write-Host "Starting agent..." -ForegroundColor Yellow
    
    $exePath = "C:\Program Files\Kuamini Security Client\KuaminiSecurityClient.exe"
    if (Test-Path $exePath) {
        try {
            Start-Process $exePath -ErrorAction Stop
            Start-Sleep -Seconds 2
            Write-Host "Agent started successfully" -ForegroundColor Green
        } catch {
            Write-Host "WARNING: Could not start agent: $($_.Exception.Message)" -ForegroundColor Yellow
            Write-Host "Agent will start on next login (autostart configured)" -ForegroundColor Yellow
        }
    } else {
        Write-Host "WARNING: Executable not found at $exePath" -ForegroundColor Yellow
    }
    
    # ============================================================================
    # VERIFY INSTALLATION
    # ============================================================================
    
    Write-Host ""
    Write-Host "Verifying installation..." -ForegroundColor Yellow
    
    Start-Sleep -Seconds 3
    
    $installPath = "C:\Program Files\Kuamini Security Client"
    if (!(Test-Path $installPath)) {
        Write-Host "ERROR: Installation path not found: $installPath" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "Installation directory exists" -ForegroundColor Cyan
    
    # Check for registration.token
    $installedTokenPath = Join-Path $installPath "registration.token"
    if (Test-Path $installedTokenPath) {
        Write-Host "Token file created in install directory" -ForegroundColor Cyan
    } else {
        Write-Host "Note: Token file not in install directory, checking backup location" -ForegroundColor Yellow
        if (Test-Path $backupTokenPath) {
            Write-Host "Token found in config directory - agent will use this" -ForegroundColor Cyan
        }
    }
    
    # Check for config
    $configPath = Join-Path $configDir "config.json"
    if (Test-Path $configPath) {
        Write-Host "Config file exists" -ForegroundColor Cyan
        $config = Get-Content $configPath | ConvertFrom-Json
        Write-Host "Account ID: $($config.account_id)" -ForegroundColor Cyan
    } else {
        Write-Host "Config not yet created (agent will create it on first run)" -ForegroundColor Cyan
    }
    
    # Check if process is running
    $process = Get-Process KuaminiSecurityClient -ErrorAction SilentlyContinue
    if ($process) {
        Write-Host "OK: Agent process is running (PID: $($process.Id))" -ForegroundColor Green
    } else {
        Write-Host "WARNING: Agent process not running (may be starting or blocked by antivirus)" -ForegroundColor Yellow
        Write-Host "If you see a SmartScreen or Defender warning, please allow it to run." -ForegroundColor Yellow
    }
    
    Write-Host ""
    Write-Host "Installation completed successfully!" -ForegroundColor Green
    Write-Host "The Kuamini Security Client agent is starting now." -ForegroundColor Cyan
    Write-Host "Look for the tray icon in the Windows system tray (bottom-right corner)." -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Agent will also auto-start on Windows login." -ForegroundColor Cyan
    
    if (!(Test-Path "C:\Program Files\Kuamini Security Client\KuaminiSecurityClient.exe")) {
        Write-Host ""
        Write-Host "WARNING: Executable not found. Checking logs:" -ForegroundColor Yellow
        Get-Content $tempLogFile -Tail 30 | Write-Host
    }
    
    # Clean up log
    Remove-Item $tempLogFile -Force -ErrorAction SilentlyContinue
    
} catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Full error: $_" -ForegroundColor Red
    if (Test-Path $tempLogFile) {
        Get-Content $tempLogFile -Tail 50 | Write-Host
    }
    exit 1
}


# SIG # Begin signature block
# MIIltwYJKoZIhvcNAQcCoIIlqDCCJaQCAQExDzANBglghkgBZQMEAgEFADB5Bgor
# BgEEAYI3AgEEoGswaTA0BgorBgEEAYI3AgEeMCYCAwEAAAQQH8w7YFlLCE63JNLG
# KX7zUQIBAAIBAAIBAAIBAAIBADAxMA0GCWCGSAFlAwQCAQUABCCL9qQef6ZLEE/q
# kmFb0UNhGtOS63jTJm1wz3pGWmiKxKCCCrkwggMwMIICtqADAgECAhA3dENPnrQO
# Ih+SNsofLycXMAoGCCqGSM49BAMDMFYxCzAJBgNVBAYTAkdCMRgwFgYDVQQKEw9T
# ZWN0aWdvIExpbWl0ZWQxLTArBgNVBAMTJFNlY3RpZ28gUHVibGljIENvZGUgU2ln
# bmluZyBSb290IEU0NjAeFw0yMTAzMjIwMDAwMDBaFw0zNjAzMjEyMzU5NTlaMFcx
# CzAJBgNVBAYTAkdCMRgwFgYDVQQKEw9TZWN0aWdvIExpbWl0ZWQxLjAsBgNVBAMT
# JVNlY3RpZ28gUHVibGljIENvZGUgU2lnbmluZyBDQSBFViBFMzYwWTATBgcqhkjO
# PQIBBggqhkjOPQMBBwNCAATeYxX2c1WJigfhpKs/AWOltt5cfDakxup7PAMZvjm4
# RlCveoj0eC3SThHbqjm6l9fMm3TcXx5+7StE0SzjIMPPo4IBYzCCAV8wHwYDVR0j
# BBgwFoAUz30soJB6mB3dtl6FwuDaFXHS5V4wHQYDVR0OBBYEFBp0pDjXubYOs1v6
# 3F6uP7bwcz2IMA4GA1UdDwEB/wQEAwIBhjASBgNVHRMBAf8ECDAGAQH/AgEAMBMG
# A1UdJQQMMAoGCCsGAQUFBwMDMBoGA1UdIAQTMBEwBgYEVR0gADAHBgVngQwBAzBL
# BgNVHR8ERDBCMECgPqA8hjpodHRwOi8vY3JsLnNlY3RpZ28uY29tL1NlY3RpZ29Q
# dWJsaWNDb2RlU2lnbmluZ1Jvb3RFNDYuY3JsMHsGCCsGAQUFBwEBBG8wbTBGBggr
# BgEFBQcwAoY6aHR0cDovL2NydC5zZWN0aWdvLmNvbS9TZWN0aWdvUHVibGljQ29k
# ZVNpZ25pbmdSb290RTQ2LnA3YzAjBggrBgEFBQcwAYYXaHR0cDovL29jc3Auc2Vj
# dGlnby5jb20wCgYIKoZIzj0EAwMDaAAwZQIxAKB6vcvgJjHZbsfIfO8toCc1571B
# Wo7A6sFhnLKpcREu1mDUOxyx2hhnaCzMRbfNpQIwBou1zB2hXfkAOmu7b3AKFLuQ
# WBe3n30THbvCYv764kIm2HrFivefIXZvZgkMBq07MIIDuzCCA2KgAwIBAgIRAOLu
# IynBSXKmD4uxzzZG8PowCgYIKoZIzj0EAwIwVzELMAkGA1UEBhMCR0IxGDAWBgNV
# BAoTD1NlY3RpZ28gTGltaXRlZDEuMCwGA1UEAxMlU2VjdGlnbyBQdWJsaWMgQ29k
# ZSBTaWduaW5nIENBIEVWIEUzNjAeFw0yNjAzMDQwMDAwMDBaFw0yNzAyMjcyMzU5
# NTlaMIG6MQ8wDQYDVQQFEwYyMDkxMDIxEzARBgsrBgEEAYI3PAIBAxMCSU4xHTAb
# BgNVBA8TFFByaXZhdGUgT3JnYW5pemF0aW9uMQswCQYDVQQGEwJJTjESMBAGA1UE
# CAwJS2FybmF0YWthMSgwJgYDVQQKDB9LdWFtaW5pIFN5c3RlbXMgUHJpdmF0ZSBM
# aW1pdGVkMSgwJgYDVQQDDB9LdWFtaW5pIFN5c3RlbXMgUHJpdmF0ZSBMaW1pdGVk
# MHYwEAYHKoZIzj0CAQYFK4EEACIDYgAEVzMTIxPVTNlwjzG2GkDo1J6GLgM7GMp7
# 57Eofy304cvPPqn/5s6oOJSw7oz/AW2Cb2auST6NPDVTfXJ4VwjGxjs8mbnV/mOY
# D3fTgF2gvx+ooRObk/jk3Q6kjVHZ7b7vo4IBjDCCAYgwHwYDVR0jBBgwFoAUGnSk
# ONe5tg6zW/rcXq4/tvBzPYgwHQYDVR0OBBYEFPZzd1nGClb5B4Fiw6YAN6Wp9zT5
# MA4GA1UdDwEB/wQEAwIHgDAMBgNVHRMBAf8EAjAAMBMGA1UdJQQMMAoGCCsGAQUF
# BwMDMEkGA1UdIARCMEAwNQYMKwYBBAGyMQECAQYBMCUwIwYIKwYBBQUHAgEWF2h0
# dHBzOi8vc2VjdGlnby5jb20vQ1BTMAcGBWeBDAEDMEsGA1UdHwREMEIwQKA+oDyG
# Omh0dHA6Ly9jcmwuc2VjdGlnby5jb20vU2VjdGlnb1B1YmxpY0NvZGVTaWduaW5n
# Q0FFVkUzNi5jcmwwewYIKwYBBQUHAQEEbzBtMEYGCCsGAQUFBzAChjpodHRwOi8v
# Y3J0LnNlY3RpZ28uY29tL1NlY3RpZ29QdWJsaWNDb2RlU2lnbmluZ0NBRVZFMzYu
# Y3J0MCMGCCsGAQUFBzABhhdodHRwOi8vb2NzcC5zZWN0aWdvLmNvbTAKBggqhkjO
# PQQDAgNHADBEAiBU8NyTUKJg4+12Wj8mpPtzL8Q3f79MTUJf8T+8Miz0LQIgMvbe
# OvDPhxFAxd6k+vLulwZupVrcLOmqquFEcAvm6KgwggPCMIICqqADAgECAhEA1bNg
# AolZon+EZcnmsY26yzANBgkqhkiG9w0BAQwFADB7MQswCQYDVQQGEwJHQjEbMBkG
# A1UECAwSR3JlYXRlciBNYW5jaGVzdGVyMRAwDgYDVQQHDAdTYWxmb3JkMRowGAYD
# VQQKDBFDb21vZG8gQ0EgTGltaXRlZDEhMB8GA1UEAwwYQUFBIENlcnRpZmljYXRl
# IFNlcnZpY2VzMB4XDTIzMDIyODAwMDAwMFoXDTI4MTIzMTIzNTk1OVowVjELMAkG
# A1UEBhMCR0IxGDAWBgNVBAoTD1NlY3RpZ28gTGltaXRlZDEtMCsGA1UEAxMkU2Vj
# dGlnbyBQdWJsaWMgQ29kZSBTaWduaW5nIFJvb3QgRTQ2MHYwEAYHKoZIzj0CAQYF
# K4EEACIDYgAECDKBAx+PO6JvgUeM5Xu5usFpsltJwCi5FFhvJDPOUJtz2TvBaDmc
# emHOXNIiR0SrgIWp5ZWsqq5mWIZWp7iDg8y00Q6pUfhLZzl/jLm2OWg0jxlKuo4h
# 60K4rFadCdwHo4IBEjCCAQ4wHwYDVR0jBBgwFoAUoBEKIz6W8Qfs4q8p74Klf9Aw
# pLQwHQYDVR0OBBYEFM99LKCQepgd3bZehcLg2hVx0uVeMA4GA1UdDwEB/wQEAwIB
# hjAPBgNVHRMBAf8EBTADAQH/MBMGA1UdJQQMMAoGCCsGAQUFBwMDMBsGA1UdIAQU
# MBIwBgYEVR0gADAIBgZngQwBBAEwQwYDVR0fBDwwOjA4oDagNIYyaHR0cDovL2Ny
# bC5jb21vZG9jYS5jb20vQUFBQ2VydGlmaWNhdGVTZXJ2aWNlcy5jcmwwNAYIKwYB
# BQUHAQEEKDAmMCQGCCsGAQUFBzABhhhodHRwOi8vb2NzcC5jb21vZG9jYS5jb20w
# DQYJKoZIhvcNAQEMBQADggEBADc/3k+qsxlJ+HvTaRt6IIKio8RhkUSnp4yL83mN
# Om/nx6/JbbAPpXIot9T7QOxp05HlAtGx1TTa1vOmuE/BzqEkYgabnhh9D4TpeJXJ
# 4NmrfXv30hNDQ+ZO95l093B/HFGgtRbu9oyakSvFBMy3/6P1dQALvj4mjxsjZM0r
# JbAyDuaxzzTJY33OCRYfuBG4pkZJbDTaWPhcwIoTzqYoOOIMS9ljMYbSGH8icSBX
# 07xY5M/GLtc5fmYZoLjgjxZkVvFW2nAG3vXCVyao0/nxqE3v9VMlmAqK6Fy+OpwD
# OvQd+n62UkGaIXgoWiycinPrAzn4tNMWwTslwiX7mSiO0d8xghpUMIIaUAIBATBs
# MFcxCzAJBgNVBAYTAkdCMRgwFgYDVQQKEw9TZWN0aWdvIExpbWl0ZWQxLjAsBgNV
# BAMTJVNlY3RpZ28gUHVibGljIENvZGUgU2lnbmluZyBDQSBFViBFMzYCEQDi7iMp
# wUlypg+Lsc82RvD6MA0GCWCGSAFlAwQCAQUAoHwwEAYKKwYBBAGCNwIBDDECMAAw
# GQYJKoZIhvcNAQkDMQwGCisGAQQBgjcCAQQwHAYKKwYBBAGCNwIBCzEOMAwGCisG
# AQQBgjcCARUwLwYJKoZIhvcNAQkEMSIEIH2bOOePWqOAuJus+bWhABNLadhyte5s
# Sbg9F9pXNsb0MAsGByqGSM49AgEFAARoMGYCMQCCNC3zqc8KRvnjAXvcZ293GEFR
# rFbJOM2s5e6n7OsVXR7BsCEECrdlz7f4N0jTgVQCMQDtxHEZQrN58cVkDrGXdVts
# HIM+ZgwtlNXgDNPs3gt2iIVdCmslxcEDWqW5iWTRmkShghjXMIIY0wYKKwYBBAGC
# NwMDATGCGMMwghi/BgkqhkiG9w0BBwKgghiwMIIYrAIBAzEPMA0GCWCGSAFlAwQC
# AgUAMIH3BgsqhkiG9w0BCRABBKCB5wSB5DCB4QIBAQYKKwYBBAGyMQIBATAxMA0G
# CWCGSAFlAwQCAQUABCCHFGLaAgeBBP1t0NBKncZqszp0Uu4u+c6VNeArpUdL9gIU
# Io3lSI1ZEKMGnJdIoyA+3vWty44YDzIwMjYwMzA4MDY1MzEzWqB2pHQwcjELMAkG
# A1UEBhMCR0IxFzAVBgNVBAgTDldlc3QgWW9ya3NoaXJlMRgwFgYDVQQKEw9TZWN0
# aWdvIExpbWl0ZWQxMDAuBgNVBAMTJ1NlY3RpZ28gUHVibGljIFRpbWUgU3RhbXBp
# bmcgU2lnbmVyIFIzNqCCEwQwggZiMIIEyqADAgECAhEApCk7bh7d16c0CIetek63
# JDANBgkqhkiG9w0BAQwFADBVMQswCQYDVQQGEwJHQjEYMBYGA1UEChMPU2VjdGln
# byBMaW1pdGVkMSwwKgYDVQQDEyNTZWN0aWdvIFB1YmxpYyBUaW1lIFN0YW1waW5n
# IENBIFIzNjAeFw0yNTAzMjcwMDAwMDBaFw0zNjAzMjEyMzU5NTlaMHIxCzAJBgNV
# BAYTAkdCMRcwFQYDVQQIEw5XZXN0IFlvcmtzaGlyZTEYMBYGA1UEChMPU2VjdGln
# byBMaW1pdGVkMTAwLgYDVQQDEydTZWN0aWdvIFB1YmxpYyBUaW1lIFN0YW1waW5n
# IFNpZ25lciBSMzYwggIiMA0GCSqGSIb3DQEBAQUAA4ICDwAwggIKAoICAQDThJX0
# bqRTePI9EEt4Egc83JSBU2dhrJ+wY7JgReuff5KQNhMuzVytzD+iXazATVPMHZpH
# /kkiMo1/vlAGFrYN2P7g0Q8oPEcR3h0SftFNYxxMh+bj3ZNbbYjwt8f4DsSHPT+x
# p9zoFuw0HOMdO3sWeA1+F8mhg6uS6BJpPwXQjNSHpVTCgd1gOmKWf12HSfSbnjl3
# kDm0kP3aIUAhsodBYZsJA1imWqkAVqwcGfvs6pbfs/0GE4BJ2aOnciKNiIV1wDRZ
# Ah7rS/O+uTQcb6JVzBVmPP63k5xcZNzGo4DOTV+sM1nVrDycWEYS8bSS0lCSeclk
# TcPjQah9Xs7xbOBoCdmahSfg8Km8ffq8PhdoAXYKOI+wlaJj+PbEuwm6rHcm24jh
# qQfQyYbOUFTKWFe901VdyMC4gRwRAq04FH2VTjBdCkhKts5Py7H73obMGrxN1uGg
# VyZho4FkqXA8/uk6nkzPH9QyHIED3c9CGIJ098hU4Ig2xRjhTbengoncXUeo/cfp
# KXDeUcAKcuKUYRNdGDlf8WnwbyqUblj4zj1kQZSnZud5EtmjIdPLKce8UhKl5+EE
# JXQp1Fkc9y5Ivk4AZacGMCVG0e+wwGsjcAADRO7Wga89r/jJ56IDK773LdIsL3yA
# NVvJKdeeS6OOEiH6hpq2yT+jJ/lHa9zEdqFqMwIDAQABo4IBjjCCAYowHwYDVR0j
# BBgwFoAUX1jtTDF6omFCjVKAurNhlxmiMpswHQYDVR0OBBYEFIhhjKEqN2SBKGCh
# mzHQjP0sAs5PMA4GA1UdDwEB/wQEAwIGwDAMBgNVHRMBAf8EAjAAMBYGA1UdJQEB
# /wQMMAoGCCsGAQUFBwMIMEoGA1UdIARDMEEwNQYMKwYBBAGyMQECAQMIMCUwIwYI
# KwYBBQUHAgEWF2h0dHBzOi8vc2VjdGlnby5jb20vQ1BTMAgGBmeBDAEEAjBKBgNV
# HR8EQzBBMD+gPaA7hjlodHRwOi8vY3JsLnNlY3RpZ28uY29tL1NlY3RpZ29QdWJs
# aWNUaW1lU3RhbXBpbmdDQVIzNi5jcmwwegYIKwYBBQUHAQEEbjBsMEUGCCsGAQUF
# BzAChjlodHRwOi8vY3J0LnNlY3RpZ28uY29tL1NlY3RpZ29QdWJsaWNUaW1lU3Rh
# bXBpbmdDQVIzNi5jcnQwIwYIKwYBBQUHMAGGF2h0dHA6Ly9vY3NwLnNlY3RpZ28u
# Y29tMA0GCSqGSIb3DQEBDAUAA4IBgQACgT6khnJRIfllqS49Uorh5ZvMSxNEk4SN
# si7qvu+bNdcuknHgXIaZyqcVmhrV3PHcmtQKt0blv/8t8DE4bL0+H0m2tgKElpUe
# u6wOH02BjCIYM6HLInbNHLf6R2qHC1SUsJ02MWNqRNIT6GQL0Xm3LW7E6hDZmR8j
# lYzhZcDdkdw0cHhXjbOLsmTeS0SeRJ1WJXEzqt25dbSOaaK7vVmkEVkOHsp16ez4
# 9Bc+Ayq/Oh2BAkSTFog43ldEKgHEDBbCIyba2E8O5lPNan+BQXOLuLMKYS3ikTcp
# /Qw63dxyDCfgqXYUhxBpXnmeSO/WA4NwdwP35lWNhmjIpNVZvhWoxDL+PxDdpph3
# +M5DroWGTc1ZuDa1iXmOFAK4iwTnlWDg3QNRsRa9cnG3FBBpVHnHOEQj4GMkrOHd
# NDTbonEeGvZ+4nSZXrwCW4Wv2qyGDBLlKk3kUW1pIScDCpm/chL6aUbnSsrtbepd
# tbCLiGanKVR/KC1gsR0tC6Q0RfWOI4owggYUMIID/KADAgECAhB6I67aU2mWD5HI
# Plz0x+M/MA0GCSqGSIb3DQEBDAUAMFcxCzAJBgNVBAYTAkdCMRgwFgYDVQQKEw9T
# ZWN0aWdvIExpbWl0ZWQxLjAsBgNVBAMTJVNlY3RpZ28gUHVibGljIFRpbWUgU3Rh
# bXBpbmcgUm9vdCBSNDYwHhcNMjEwMzIyMDAwMDAwWhcNMzYwMzIxMjM1OTU5WjBV
# MQswCQYDVQQGEwJHQjEYMBYGA1UEChMPU2VjdGlnbyBMaW1pdGVkMSwwKgYDVQQD
# EyNTZWN0aWdvIFB1YmxpYyBUaW1lIFN0YW1waW5nIENBIFIzNjCCAaIwDQYJKoZI
# hvcNAQEBBQADggGPADCCAYoCggGBAM2Y2ENBq26CK+z2M34mNOSJjNPvIhKAVD7v
# Jq+MDoGD46IiM+b83+3ecLvBhStSVjeYXIjfa3ajoW3cS3ElcJzkyZlBnwDEJuHl
# zpbN4kMH2qRBVrjrGJgSlzzUqcGQBaCxpectRGhhnOSwcjPMI3G0hedv2eNmGiUb
# D12OeORN0ADzdpsQ4dDi6M4YhoGE9cbY11XxM2AVZn0GiOUC9+XE0wI7CQKfOUfi
# gLDn7i/WeyxZ43XLj5GVo7LDBExSLnh+va8WxTlA+uBvq1KO8RSHUQLgzb1gbL9I
# hgzxmkdp2ZWNuLc+XyEmJNbD2OIIq/fWlwBp6KNL19zpHsODLIsgZ+WZ1AzCs1HE
# K6VWrxmnKyJJg2Lv23DlEdZlQSGdF+z+Gyn9/CRezKe7WNyxRf4e4bwUtrYE2F5Q
# +05yDD68clwnweckKtxRaF0VzN/w76kOLIaFVhf5sMM/caEZLtOYqYadtn034ykS
# FaZuIBU9uCSrKRKTPJhWvXk4CllgrwIDAQABo4IBXDCCAVgwHwYDVR0jBBgwFoAU
# 9ndq3T/9ARP/FqFsggIv0Ao9FCUwHQYDVR0OBBYEFF9Y7UwxeqJhQo1SgLqzYZcZ
# ojKbMA4GA1UdDwEB/wQEAwIBhjASBgNVHRMBAf8ECDAGAQH/AgEAMBMGA1UdJQQM
# MAoGCCsGAQUFBwMIMBEGA1UdIAQKMAgwBgYEVR0gADBMBgNVHR8ERTBDMEGgP6A9
# hjtodHRwOi8vY3JsLnNlY3RpZ28uY29tL1NlY3RpZ29QdWJsaWNUaW1lU3RhbXBp
# bmdSb290UjQ2LmNybDB8BggrBgEFBQcBAQRwMG4wRwYIKwYBBQUHMAKGO2h0dHA6
# Ly9jcnQuc2VjdGlnby5jb20vU2VjdGlnb1B1YmxpY1RpbWVTdGFtcGluZ1Jvb3RS
# NDYucDdjMCMGCCsGAQUFBzABhhdodHRwOi8vb2NzcC5zZWN0aWdvLmNvbTANBgkq
# hkiG9w0BAQwFAAOCAgEAEtd7IK0ONVgMnoEdJVj9TC1ndK/HYiYh9lVUacahRoZ2
# W2hfiEOyQExnHk1jkvpIJzAMxmEc6ZvIyHI5UkPCbXKspioYMdbOnBWQUn733qMo
# oBfIghpR/klUqNxx6/fDXqY0hSU1OSkkSivt51UlmJElUICZYBodzD3M/SFjeCP5
# 9anwxs6hwj1mfvzG+b1coYGnqsSz2wSKr+nDO+Db8qNcTbJZRAiSazr7KyUJGo1c
# +MScGfG5QHV+bps8BX5Oyv9Ct36Y4Il6ajTqV2ifikkVtB3RNBUgwu/mSiSUice/
# Jp/q8BMk/gN8+0rNIE+QqU63JoVMCMPY2752LmESsRVVoypJVt8/N3qQ1c6Fibbc
# Rabo3azZkcIdWGVSAdoLgAIxEKBeNh9AQO1gQrnh1TA8ldXuJzPSuALOz1Ujb0PC
# yNVkWk7hkhVHfcvBfI8NtgWQupiaAeNHe0pWSGH2opXZYKYG4Lbukg7HpNi/KqJh
# ue2Keak6qH9A8CeEOB7Eob0Zf+fU+CCQaL0cJqlmnx9HCDxF+3BLbUufrV64EbTI
# 40zqegPZdA+sXCmbcZy6okx/SjwsusWRItFA3DE8MORZeFb6BmzBtqKJ7l939bbK
# By2jvxcJI98Va95Q5JnlKor3m0E7xpMeYRriWklUPsetMSf2NvUQa/E5vVyefQIw
# ggaCMIIEaqADAgECAhA2wrC9fBs656Oz3TbLyXVoMA0GCSqGSIb3DQEBDAUAMIGI
# MQswCQYDVQQGEwJVUzETMBEGA1UECBMKTmV3IEplcnNleTEUMBIGA1UEBxMLSmVy
# c2V5IENpdHkxHjAcBgNVBAoTFVRoZSBVU0VSVFJVU1QgTmV0d29yazEuMCwGA1UE
# AxMlVVNFUlRydXN0IFJTQSBDZXJ0aWZpY2F0aW9uIEF1dGhvcml0eTAeFw0yMTAz
# MjIwMDAwMDBaFw0zODAxMTgyMzU5NTlaMFcxCzAJBgNVBAYTAkdCMRgwFgYDVQQK
# Ew9TZWN0aWdvIExpbWl0ZWQxLjAsBgNVBAMTJVNlY3RpZ28gUHVibGljIFRpbWUg
# U3RhbXBpbmcgUm9vdCBSNDYwggIiMA0GCSqGSIb3DQEBAQUAA4ICDwAwggIKAoIC
# AQCIndi5RWedHd3ouSaBmlRUwHxJBZvMWhUP2ZQQRLRBQIF3FJmp1OR2LMgIU14g
# 0JIlL6VXWKmdbmKGRDILRxEtZdQnOh2qmcxGzjqemIk8et8sE6J+N+Gl1cnZocew
# 8eCAawKLu4TRrCoqCAT8uRjDeypoGJrruH/drCio28aqIVEn45NZiZQI7YYBex48
# eL78lQ0BrHeSmqy1uXe9xN04aG0pKG9ki+PC6VEfzutu6Q3IcZZfm00r9YAEp/4a
# eiLhyaKxLuhKKaAdQjRaf/h6U13jQEV1JnUTCm511n5avv4N+jSVwd+Wb8UMOs4n
# etapq5Q/yGyiQOgjsP/JRUj0MAT9YrcmXcLgsrAimfWY3MzKm1HCxcquinTqbs1Q
# 0d2VMMQyi9cAgMYC9jKc+3mW62/yVl4jnDcw6ULJsBkOkrcPLUwqj7poS0T2+2JM
# zPP+jZ1h90/QpZnBkhdtixMiWDVgh60KmLmzXiqJc6lGwqoUqpq/1HVHm+Pc2B6+
# wCy/GwCcjw5rmzajLbmqGygEgaj/OLoanEWP6Y52Hflef3XLvYnhEY4kSirMQhtb
# erRvaI+5YsD3XVxHGBjlIli5u+NrLedIxsE88WzKXqZjj9Zi5ybJL2WjeXuOTbsw
# B7XjkZbErg7ebeAQUQiS/uRGZ58NHs57ZPUfECcgJC+v2wIDAQABo4IBFjCCARIw
# HwYDVR0jBBgwFoAUU3m/WqorSs9UgOHYm8Cd8rIDZsswHQYDVR0OBBYEFPZ3at0/
# /QET/xahbIICL9AKPRQlMA4GA1UdDwEB/wQEAwIBhjAPBgNVHRMBAf8EBTADAQH/
# MBMGA1UdJQQMMAoGCCsGAQUFBwMIMBEGA1UdIAQKMAgwBgYEVR0gADBQBgNVHR8E
# STBHMEWgQ6BBhj9odHRwOi8vY3JsLnVzZXJ0cnVzdC5jb20vVVNFUlRydXN0UlNB
# Q2VydGlmaWNhdGlvbkF1dGhvcml0eS5jcmwwNQYIKwYBBQUHAQEEKTAnMCUGCCsG
# AQUFBzABhhlodHRwOi8vb2NzcC51c2VydHJ1c3QuY29tMA0GCSqGSIb3DQEBDAUA
# A4ICAQAOvmVB7WhEuOWhxdQRh+S3OyWM637ayBeR7djxQ8SihTnLf2sABFoB0DFR
# 6JfWS0snf6WDG2gtCGflwVvcYXZJJlFfym1Doi+4PfDP8s0cqlDmdfyGOwMtGGzJ
# 4iImyaz3IBae91g50QyrVbrUoT0mUGQHbRcF57olpfHhQEStz5i6hJvVLFV/ueQ2
# 1SM99zG4W2tB1ExGL98idX8ChsTwbD/zIExAopoe3l6JrzJtPxj8V9rocAnLP2C8
# Q5wXVVZcbw4x4ztXLsGzqZIiRh5i111TW7HV1AtsQa6vXy633vCAbAOIaKcLAo/I
# U7sClyZUk62XD0VUnHD+YvVNvIGezjM6CRpcWed/ODiptK+evDKPU2K6synimYBa
# NH49v9Ih24+eYXNtI38byt5kIvh+8aW88WThRpv8lUJKaPn37+YHYafob9Rg7LyT
# rSYpyZoBmwRWSE4W6iPjB7wJjJpH29308ZkpKKdpkiS9WNsf/eeUtvRrtIEiSJHN
# 899L1P4l6zKVsdrUu1FX1T/ubSrsxrYJD+3f3aKg6yxdbugot06YwGXXiy5UUGZv
# Ou3lXlxA+fC13dQ5OlL2gIb5lmF6Ii8+CQOYDwXM+yd9dbmocQsHjcRPsccUd5E9
# FiswEqORvz8g3s+jR3SFCgXhN4wz7NgAnOgpCdUo4uDyllU9PzGCBJIwggSOAgEB
# MGowVTELMAkGA1UEBhMCR0IxGDAWBgNVBAoTD1NlY3RpZ28gTGltaXRlZDEsMCoG
# A1UEAxMjU2VjdGlnbyBQdWJsaWMgVGltZSBTdGFtcGluZyBDQSBSMzYCEQCkKTtu
# Ht3XpzQIh616TrckMA0GCWCGSAFlAwQCAgUAoIIB+TAaBgkqhkiG9w0BCQMxDQYL
# KoZIhvcNAQkQAQQwHAYJKoZIhvcNAQkFMQ8XDTI2MDMwODA2NTMxM1owPwYJKoZI
# hvcNAQkEMTIEMEFeYoPLYU3KlD742i4X6EkO9WaWWeraaWIbiFU850fIYcWOFJfm
# U9+Wt6jIO2RNijCCAXoGCyqGSIb3DQEJEAIMMYIBaTCCAWUwggFhMBYEFDjJFIEQ
# RLTcZj6T1HRLgUGGqbWxMIGHBBTGrlTkeIbxfD1VEkiMacNKevnC3TBvMFukWTBX
# MQswCQYDVQQGEwJHQjEYMBYGA1UEChMPU2VjdGlnbyBMaW1pdGVkMS4wLAYDVQQD
# EyVTZWN0aWdvIFB1YmxpYyBUaW1lIFN0YW1waW5nIFJvb3QgUjQ2AhB6I67aU2mW
# D5HIPlz0x+M/MIG8BBSFPWMtk4KCYXzQkDXEkd6SwULaxzCBozCBjqSBizCBiDEL
# MAkGA1UEBhMCVVMxEzARBgNVBAgTCk5ldyBKZXJzZXkxFDASBgNVBAcTC0plcnNl
# eSBDaXR5MR4wHAYDVQQKExVUaGUgVVNFUlRSVVNUIE5ldHdvcmsxLjAsBgNVBAMT
# JVVTRVJUcnVzdCBSU0EgQ2VydGlmaWNhdGlvbiBBdXRob3JpdHkCEDbCsL18Gzrn
# o7PdNsvJdWgwDQYJKoZIhvcNAQEBBQAEggIACFPS9+ZsLZwa70AjL56ooJ6Q+2/x
# 3daES7BSLQlQbfEwYVgBD6o4oFVUNG8bgzGF8DlJJuChOre9WtAi/VjiWRf/9OUc
# h/CaCfDvYYf4JdNa4aKZHg/3B3X5tynPJtK99b/rE4TCq+RA1ZItRhcDFebRVrQ6
# ZX/Z0baQ+S5RahpGou/rJvidyB5KFLUUwll/Fvx7grucVw75nZScnXUKJP9FpAMt
# QQigCocP8p2cjnNcBc9CLbBHrxOM4HGdoovmsx48drADP3BagAYEQAjb63N64apb
# djiedMuRwLNs5+1I1LFsR+LluZSWhEiirfM0Y5NqNN5u6yCpQFzPqvMf/sgPQhp5
# cLZ9J2PAnWlppkP1qyWDPld2xYzwNUwvCbLCxlRVZ+BYA+rT0zM9rqyXpgogXnfD
# JEKtcaFWTWTGYuAuLvtKR1POlf7zYcnQvmtn2KOtqbdrQ26ksyp7raKSR0nH8O2i
# oOBIyoENIfyDMmiG0NRV919xVrd/0zHcVauMW4t0nJ3Y4NKr3YRGXpXo+TxwlPxM
# PTw0bsZbAk7ysIPsxU6Lsb6QvNcDVnaEyNrs9IaJu8G2NaJ/uJhgTZVCVj7+FOor
# MaCbKqUhWvH95+6nS9tBCWm8KW9i5WMlRyM/PkTZ4o3YyIAIZ7p7mAG4pE+HyCxq
# 1fiDUrH+9LSvk1E=
# SIG # End signature block
