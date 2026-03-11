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
# MIIjJAYJKoZIhvcNAQcCoIIjFTCCIxECAQExCzAJBgUrDgMCGgUAMGkGCisGAQQB
# gjcCAQSgWzBZMDQGCisGAQQBgjcCAR4wJgIDAQAABBAfzDtgWUsITrck0sYpfvNR
# AgEAAgEAAgEAAgEAAgEAMCEwCQYFKw4DAhoFAAQUVnWPIr0IWJ6PHT0iIBGvw5Rt
# 19yggh3zMIIDMDCCAragAwIBAgIQN3RDT560DiIfkjbKHy8nFzAKBggqhkjOPQQD
# AzBWMQswCQYDVQQGEwJHQjEYMBYGA1UEChMPU2VjdGlnbyBMaW1pdGVkMS0wKwYD
# VQQDEyRTZWN0aWdvIFB1YmxpYyBDb2RlIFNpZ25pbmcgUm9vdCBFNDYwHhcNMjEw
# MzIyMDAwMDAwWhcNMzYwMzIxMjM1OTU5WjBXMQswCQYDVQQGEwJHQjEYMBYGA1UE
# ChMPU2VjdGlnbyBMaW1pdGVkMS4wLAYDVQQDEyVTZWN0aWdvIFB1YmxpYyBDb2Rl
# IFNpZ25pbmcgQ0EgRVYgRTM2MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE3mMV
# 9nNViYoH4aSrPwFjpbbeXHw2pMbqezwDGb45uEZQr3qI9Hgt0k4R26o5upfXzJt0
# 3F8efu0rRNEs4yDDz6OCAWMwggFfMB8GA1UdIwQYMBaAFM99LKCQepgd3bZehcLg
# 2hVx0uVeMB0GA1UdDgQWBBQadKQ417m2DrNb+txerj+28HM9iDAOBgNVHQ8BAf8E
# BAMCAYYwEgYDVR0TAQH/BAgwBgEB/wIBADATBgNVHSUEDDAKBggrBgEFBQcDAzAa
# BgNVHSAEEzARMAYGBFUdIAAwBwYFZ4EMAQMwSwYDVR0fBEQwQjBAoD6gPIY6aHR0
# cDovL2NybC5zZWN0aWdvLmNvbS9TZWN0aWdvUHVibGljQ29kZVNpZ25pbmdSb290
# RTQ2LmNybDB7BggrBgEFBQcBAQRvMG0wRgYIKwYBBQUHMAKGOmh0dHA6Ly9jcnQu
# c2VjdGlnby5jb20vU2VjdGlnb1B1YmxpY0NvZGVTaWduaW5nUm9vdEU0Ni5wN2Mw
# IwYIKwYBBQUHMAGGF2h0dHA6Ly9vY3NwLnNlY3RpZ28uY29tMAoGCCqGSM49BAMD
# A2gAMGUCMQCger3L4CYx2W7HyHzvLaAnNee9QVqOwOrBYZyyqXERLtZg1DscsdoY
# Z2gszEW3zaUCMAaLtcwdoV35ADpru29wChS7kFgXt599Ex27wmL++uJCJth6xYr3
# nyF2b2YJDAatOzCCA7swggNioAMCAQICEQDi7iMpwUlypg+Lsc82RvD6MAoGCCqG
# SM49BAMCMFcxCzAJBgNVBAYTAkdCMRgwFgYDVQQKEw9TZWN0aWdvIExpbWl0ZWQx
# LjAsBgNVBAMTJVNlY3RpZ28gUHVibGljIENvZGUgU2lnbmluZyBDQSBFViBFMzYw
# HhcNMjYwMzA0MDAwMDAwWhcNMjcwMjI3MjM1OTU5WjCBujEPMA0GA1UEBRMGMjA5
# MTAyMRMwEQYLKwYBBAGCNzwCAQMTAklOMR0wGwYDVQQPExRQcml2YXRlIE9yZ2Fu
# aXphdGlvbjELMAkGA1UEBhMCSU4xEjAQBgNVBAgMCUthcm5hdGFrYTEoMCYGA1UE
# CgwfS3VhbWluaSBTeXN0ZW1zIFByaXZhdGUgTGltaXRlZDEoMCYGA1UEAwwfS3Vh
# bWluaSBTeXN0ZW1zIFByaXZhdGUgTGltaXRlZDB2MBAGByqGSM49AgEGBSuBBAAi
# A2IABFczEyMT1UzZcI8xthpA6NSehi4DOxjKe+exKH8t9OHLzz6p/+bOqDiUsO6M
# /wFtgm9mrkk+jTw1U31yeFcIxsY7PJm51f5jmA9304BdoL8fqKETm5P45N0OpI1R
# 2e2+76OCAYwwggGIMB8GA1UdIwQYMBaAFBp0pDjXubYOs1v63F6uP7bwcz2IMB0G
# A1UdDgQWBBT2c3dZxgpW+QeBYsOmADelqfc0+TAOBgNVHQ8BAf8EBAMCB4AwDAYD
# VR0TAQH/BAIwADATBgNVHSUEDDAKBggrBgEFBQcDAzBJBgNVHSAEQjBAMDUGDCsG
# AQQBsjEBAgEGATAlMCMGCCsGAQUFBwIBFhdodHRwczovL3NlY3RpZ28uY29tL0NQ
# UzAHBgVngQwBAzBLBgNVHR8ERDBCMECgPqA8hjpodHRwOi8vY3JsLnNlY3RpZ28u
# Y29tL1NlY3RpZ29QdWJsaWNDb2RlU2lnbmluZ0NBRVZFMzYuY3JsMHsGCCsGAQUF
# BwEBBG8wbTBGBggrBgEFBQcwAoY6aHR0cDovL2NydC5zZWN0aWdvLmNvbS9TZWN0
# aWdvUHVibGljQ29kZVNpZ25pbmdDQUVWRTM2LmNydDAjBggrBgEFBQcwAYYXaHR0
# cDovL29jc3Auc2VjdGlnby5jb20wCgYIKoZIzj0EAwIDRwAwRAIgVPDck1CiYOPt
# dlo/JqT7cy/EN3+/TE1CX/E/vDIs9C0CIDL23jrwz4cRQMXepPry7pcGbqVa3Czp
# qqrhRHAL5uioMIIDwjCCAqqgAwIBAgIRANWzYAKJWaJ/hGXJ5rGNusswDQYJKoZI
# hvcNAQEMBQAwezELMAkGA1UEBhMCR0IxGzAZBgNVBAgMEkdyZWF0ZXIgTWFuY2hl
# c3RlcjEQMA4GA1UEBwwHU2FsZm9yZDEaMBgGA1UECgwRQ29tb2RvIENBIExpbWl0
# ZWQxITAfBgNVBAMMGEFBQSBDZXJ0aWZpY2F0ZSBTZXJ2aWNlczAeFw0yMzAyMjgw
# MDAwMDBaFw0yODEyMzEyMzU5NTlaMFYxCzAJBgNVBAYTAkdCMRgwFgYDVQQKEw9T
# ZWN0aWdvIExpbWl0ZWQxLTArBgNVBAMTJFNlY3RpZ28gUHVibGljIENvZGUgU2ln
# bmluZyBSb290IEU0NjB2MBAGByqGSM49AgEGBSuBBAAiA2IABAgygQMfjzuib4FH
# jOV7ubrBabJbScAouRRYbyQzzlCbc9k7wWg5nHphzlzSIkdEq4CFqeWVrKquZliG
# Vqe4g4PMtNEOqVH4S2c5f4y5tjloNI8ZSrqOIetCuKxWnQncB6OCARIwggEOMB8G
# A1UdIwQYMBaAFKARCiM+lvEH7OKvKe+CpX/QMKS0MB0GA1UdDgQWBBTPfSygkHqY
# Hd22XoXC4NoVcdLlXjAOBgNVHQ8BAf8EBAMCAYYwDwYDVR0TAQH/BAUwAwEB/zAT
# BgNVHSUEDDAKBggrBgEFBQcDAzAbBgNVHSAEFDASMAYGBFUdIAAwCAYGZ4EMAQQB
# MEMGA1UdHwQ8MDowOKA2oDSGMmh0dHA6Ly9jcmwuY29tb2RvY2EuY29tL0FBQUNl
# cnRpZmljYXRlU2VydmljZXMuY3JsMDQGCCsGAQUFBwEBBCgwJjAkBggrBgEFBQcw
# AYYYaHR0cDovL29jc3AuY29tb2RvY2EuY29tMA0GCSqGSIb3DQEBDAUAA4IBAQA3
# P95PqrMZSfh702kbeiCCoqPEYZFEp6eMi/N5jTpv58evyW2wD6VyKLfU+0DsadOR
# 5QLRsdU02tbzprhPwc6hJGIGm54YfQ+E6XiVyeDZq31799ITQ0PmTveZdPdwfxxR
# oLUW7vaMmpErxQTMt/+j9XUAC74+Jo8bI2TNKyWwMg7msc80yWN9zgkWH7gRuKZG
# SWw02lj4XMCKE86mKDjiDEvZYzGG0hh/InEgV9O8WOTPxi7XOX5mGaC44I8WZFbx
# VtpwBt71wlcmqNP58ahN7/VTJZgKiuhcvjqcAzr0Hfp+tlJBmiF4KFosnIpz6wM5
# +LTTFsE7JcIl+5kojtHfMIIFjTCCBHWgAwIBAgIQDpsYjvnQLefv21DiCEAYWjAN
# BgkqhkiG9w0BAQwFADBlMQswCQYDVQQGEwJVUzEVMBMGA1UEChMMRGlnaUNlcnQg
# SW5jMRkwFwYDVQQLExB3d3cuZGlnaWNlcnQuY29tMSQwIgYDVQQDExtEaWdpQ2Vy
# dCBBc3N1cmVkIElEIFJvb3QgQ0EwHhcNMjIwODAxMDAwMDAwWhcNMzExMTA5MjM1
# OTU5WjBiMQswCQYDVQQGEwJVUzEVMBMGA1UEChMMRGlnaUNlcnQgSW5jMRkwFwYD
# VQQLExB3d3cuZGlnaWNlcnQuY29tMSEwHwYDVQQDExhEaWdpQ2VydCBUcnVzdGVk
# IFJvb3QgRzQwggIiMA0GCSqGSIb3DQEBAQUAA4ICDwAwggIKAoICAQC/5pBzaN67
# 5F1KPDAiMGkz7MKnJS7JIT3yithZwuEppz1Yq3aaza57G4QNxDAf8xukOBbrVsaX
# bR2rsnnyyhHS5F/WBTxSD1Ifxp4VpX6+n6lXFllVcq9ok3DCsrp1mWpzMpTREEQQ
# Lt+C8weE5nQ7bXHiLQwb7iDVySAdYyktzuxeTsiT+CFhmzTrBcZe7FsavOvJz82s
# NEBfsXpm7nfISKhmV1efVFiODCu3T6cw2Vbuyntd463JT17lNecxy9qTXtyOj4Da
# tpGYQJB5w3jHtrHEtWoYOAMQjdjUN6QuBX2I9YI+EJFwq1WCQTLX2wRzKm6RAXwh
# TNS8rhsDdV14Ztk6MUSaM0C/CNdaSaTC5qmgZ92kJ7yhTzm1EVgX9yRcRo9k98Fp
# iHaYdj1ZXUJ2h4mXaXpI8OCiEhtmmnTK3kse5w5jrubU75KSOp493ADkRSWJtppE
# GSt+wJS00mFt6zPZxd9LBADMfRyVw4/3IbKyEbe7f/LVjHAsQWCqsWMYRJUadmJ+
# 9oCw++hkpjPRiQfhvbfmQ6QYuKZ3AeEPlAwhHbJUKSWJbOUOUlFHdL4mrLZBdd56
# rF+NP8m800ERElvlEFDrMcXKchYiCd98THU/Y+whX8QgUWtvsauGi0/C1kVfnSD8
# oR7FwI+isX4KJpn15GkvmB0t9dmpsh3lGwIDAQABo4IBOjCCATYwDwYDVR0TAQH/
# BAUwAwEB/zAdBgNVHQ4EFgQU7NfjgtJxXWRM3y5nP+e6mK4cD08wHwYDVR0jBBgw
# FoAUReuir/SSy4IxLVGLp6chnfNtyA8wDgYDVR0PAQH/BAQDAgGGMHkGCCsGAQUF
# BwEBBG0wazAkBggrBgEFBQcwAYYYaHR0cDovL29jc3AuZGlnaWNlcnQuY29tMEMG
# CCsGAQUFBzAChjdodHRwOi8vY2FjZXJ0cy5kaWdpY2VydC5jb20vRGlnaUNlcnRB
# c3N1cmVkSURSb290Q0EuY3J0MEUGA1UdHwQ+MDwwOqA4oDaGNGh0dHA6Ly9jcmwz
# LmRpZ2ljZXJ0LmNvbS9EaWdpQ2VydEFzc3VyZWRJRFJvb3RDQS5jcmwwEQYDVR0g
# BAowCDAGBgRVHSAAMA0GCSqGSIb3DQEBDAUAA4IBAQBwoL9DXFXnOF+go3QbPbYW
# 1/e/Vwe9mqyhhyzshV6pGrsi+IcaaVQi7aSId229GhT0E0p6Ly23OO/0/4C5+KH3
# 8nLeJLxSA8hO0Cre+i1Wz/n096wwepqLsl7Uz9FDRJtDIeuWcqFItJnLnU+nBgMT
# dydE1Od/6Fmo8L8vC6bp8jQ87PcDx4eo0kxAGTVGamlUsLihVo7spNU96LHc/RzY
# 9HdaXFSMb++hUD38dglohJ9vytsgjTVgHAIDyyCwrFigDkBjxZgiwbJZ9VVrzyer
# bHbObyMt9H5xaiNrIv8SuFQtJ37YOtnwtoeW/VvRXKwYw02fc7cBqZ9Xql4o4rmU
# MIIGtDCCBJygAwIBAgIQDcesVwX/IZkuQEMiDDpJhjANBgkqhkiG9w0BAQsFADBi
# MQswCQYDVQQGEwJVUzEVMBMGA1UEChMMRGlnaUNlcnQgSW5jMRkwFwYDVQQLExB3
# d3cuZGlnaWNlcnQuY29tMSEwHwYDVQQDExhEaWdpQ2VydCBUcnVzdGVkIFJvb3Qg
# RzQwHhcNMjUwNTA3MDAwMDAwWhcNMzgwMTE0MjM1OTU5WjBpMQswCQYDVQQGEwJV
# UzEXMBUGA1UEChMORGlnaUNlcnQsIEluYy4xQTA/BgNVBAMTOERpZ2lDZXJ0IFRy
# dXN0ZWQgRzQgVGltZVN0YW1waW5nIFJTQTQwOTYgU0hBMjU2IDIwMjUgQ0ExMIIC
# IjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAtHgx0wqYQXK+PEbAHKx126NG
# aHS0URedTa2NDZS1mZaDLFTtQ2oRjzUXMmxCqvkbsDpz4aH+qbxeLho8I6jY3xL1
# IusLopuW2qftJYJaDNs1+JH7Z+QdSKWM06qchUP+AbdJgMQB3h2DZ0Mal5kYp77j
# YMVQXSZH++0trj6Ao+xh/AS7sQRuQL37QXbDhAktVJMQbzIBHYJBYgzWIjk8eDrY
# hXDEpKk7RdoX0M980EpLtlrNyHw0Xm+nt5pnYJU3Gmq6bNMI1I7Gb5IBZK4ivbVC
# iZv7PNBYqHEpNVWC2ZQ8BbfnFRQVESYOszFI2Wv82wnJRfN20VRS3hpLgIR4hjzL
# 0hpoYGk81coWJ+KdPvMvaB0WkE/2qHxJ0ucS638ZxqU14lDnki7CcoKCz6eum5A1
# 9WZQHkqUJfdkDjHkccpL6uoG8pbF0LJAQQZxst7VvwDDjAmSFTUms+wV/FbWBqi7
# fTJnjq3hj0XbQcd8hjj/q8d6ylgxCZSKi17yVp2NL+cnT6Toy+rN+nM8M7LnLqCr
# O2JP3oW//1sfuZDKiDEb1AQ8es9Xr/u6bDTnYCTKIsDq1BtmXUqEG1NqzJKS4kOm
# xkYp2WyODi7vQTCBZtVFJfVZ3j7OgWmnhFr4yUozZtqgPrHRVHhGNKlYzyjlroPx
# ul+bgIspzOwbtmsgY1MCAwEAAaOCAV0wggFZMBIGA1UdEwEB/wQIMAYBAf8CAQAw
# HQYDVR0OBBYEFO9vU0rp5AZ8esrikFb2L9RJ7MtOMB8GA1UdIwQYMBaAFOzX44LS
# cV1kTN8uZz/nupiuHA9PMA4GA1UdDwEB/wQEAwIBhjATBgNVHSUEDDAKBggrBgEF
# BQcDCDB3BggrBgEFBQcBAQRrMGkwJAYIKwYBBQUHMAGGGGh0dHA6Ly9vY3NwLmRp
# Z2ljZXJ0LmNvbTBBBggrBgEFBQcwAoY1aHR0cDovL2NhY2VydHMuZGlnaWNlcnQu
# Y29tL0RpZ2lDZXJ0VHJ1c3RlZFJvb3RHNC5jcnQwQwYDVR0fBDwwOjA4oDagNIYy
# aHR0cDovL2NybDMuZGlnaWNlcnQuY29tL0RpZ2lDZXJ0VHJ1c3RlZFJvb3RHNC5j
# cmwwIAYDVR0gBBkwFzAIBgZngQwBBAIwCwYJYIZIAYb9bAcBMA0GCSqGSIb3DQEB
# CwUAA4ICAQAXzvsWgBz+Bz0RdnEwvb4LyLU0pn/N0IfFiBowf0/Dm1wGc/Do7oVM
# Y2mhXZXjDNJQa8j00DNqhCT3t+s8G0iP5kvN2n7Jd2E4/iEIUBO41P5F448rSYJ5
# 9Ib61eoalhnd6ywFLerycvZTAz40y8S4F3/a+Z1jEMK/DMm/axFSgoR8n6c3nuZB
# 9BfBwAQYK9FHaoq2e26MHvVY9gCDA/JYsq7pGdogP8HRtrYfctSLANEBfHU16r3J
# 05qX3kId+ZOczgj5kjatVB+NdADVZKON/gnZruMvNYY2o1f4MXRJDMdTSlOLh0HC
# n2cQLwQCqjFbqrXuvTPSegOOzr4EWj7PtspIHBldNE2K9i697cvaiIo2p61Ed2p8
# xMJb82Yosn0z4y25xUbI7GIN/TpVfHIqQ6Ku/qjTY6hc3hsXMrS+U0yy+GWqAXam
# 4ToWd2UQ1KYT70kZjE4YtL8Pbzg0c1ugMZyZZd/BdHLiRu7hAWE6bTEm4XYRkA6T
# l4KSFLFk43esaUeqGkH/wyW4N7OigizwJWeukcyIPbAvjSabnf7+Pu0VrFgoiovR
# Diyx3zEdmcif/sYQsfch28bZeUz2rtY/9TCA6TD8dC3JE3rYkrhLULy7Dc90G6e8
# BlqmyIjlgp2+VqsS9/wQD7yFylIz0scmbKvFoW2jNrbM1pD2T7m3XDCCBu0wggTV
# oAMCAQICEAqA7xhLjfEFgtHEdqeVdGgwDQYJKoZIhvcNAQELBQAwaTELMAkGA1UE
# BhMCVVMxFzAVBgNVBAoTDkRpZ2lDZXJ0LCBJbmMuMUEwPwYDVQQDEzhEaWdpQ2Vy
# dCBUcnVzdGVkIEc0IFRpbWVTdGFtcGluZyBSU0E0MDk2IFNIQTI1NiAyMDI1IENB
# MTAeFw0yNTA2MDQwMDAwMDBaFw0zNjA5MDMyMzU5NTlaMGMxCzAJBgNVBAYTAlVT
# MRcwFQYDVQQKEw5EaWdpQ2VydCwgSW5jLjE7MDkGA1UEAxMyRGlnaUNlcnQgU0hB
# MjU2IFJTQTQwOTYgVGltZXN0YW1wIFJlc3BvbmRlciAyMDI1IDEwggIiMA0GCSqG
# SIb3DQEBAQUAA4ICDwAwggIKAoICAQDQRqwtEsae0OquYFazK1e6b1H/hnAKAd/K
# N8wZQjBjMqiZ3xTWcfsLwOvRxUwXcGx8AUjni6bz52fGTfr6PHRNv6T7zsf1Y/E3
# IU8kgNkeECqVQ+3bzWYesFtkepErvUSbf+EIYLkrLKd6qJnuzK8Vcn0DvbDMemQF
# oxQ2Dsw4vEjoT1FpS54dNApZfKY61HAldytxNM89PZXUP/5wWWURK+IfxiOg8W9l
# KMqzdIo7VA1R0V3Zp3DjjANwqAf4lEkTlCDQ0/fKJLKLkzGBTpx6EYevvOi7XOc4
# zyh1uSqgr6UnbksIcFJqLbkIXIPbcNmA98Oskkkrvt6lPAw/p4oDSRZreiwB7x9y
# krjS6GS3NR39iTTFS+ENTqW8m6THuOmHHjQNC3zbJ6nJ6SXiLSvw4Smz8U07hqF+
# 8CTXaETkVWz0dVVZw7knh1WZXOLHgDvundrAtuvz0D3T+dYaNcwafsVCGZKUhQPL
# 1naFKBy1p6llN3QgshRta6Eq4B40h5avMcpi54wm0i2ePZD5pPIssoszQyF4//3D
# oK2O65Uck5Wggn8O2klETsJ7u8xEehGifgJYi+6I03UuT1j7FnrqVrOzaQoVJOee
# StPeldYRNMmSF3voIgMFtNGh86w3ISHNm0IaadCKCkUe2LnwJKa8TIlwCUNVwppw
# n4D3/Pt5pwIDAQABo4IBlTCCAZEwDAYDVR0TAQH/BAIwADAdBgNVHQ4EFgQU5Dv8
# 8jHt/f3X85FxYxlQQ89hjOgwHwYDVR0jBBgwFoAU729TSunkBnx6yuKQVvYv1Ens
# y04wDgYDVR0PAQH/BAQDAgeAMBYGA1UdJQEB/wQMMAoGCCsGAQUFBwMIMIGVBggr
# BgEFBQcBAQSBiDCBhTAkBggrBgEFBQcwAYYYaHR0cDovL29jc3AuZGlnaWNlcnQu
# Y29tMF0GCCsGAQUFBzAChlFodHRwOi8vY2FjZXJ0cy5kaWdpY2VydC5jb20vRGln
# aUNlcnRUcnVzdGVkRzRUaW1lU3RhbXBpbmdSU0E0MDk2U0hBMjU2MjAyNUNBMS5j
# cnQwXwYDVR0fBFgwVjBUoFKgUIZOaHR0cDovL2NybDMuZGlnaWNlcnQuY29tL0Rp
# Z2lDZXJ0VHJ1c3RlZEc0VGltZVN0YW1waW5nUlNBNDA5NlNIQTI1NjIwMjVDQTEu
# Y3JsMCAGA1UdIAQZMBcwCAYGZ4EMAQQCMAsGCWCGSAGG/WwHATANBgkqhkiG9w0B
# AQsFAAOCAgEAZSqt8RwnBLmuYEHs0QhEnmNAciH45PYiT9s1i6UKtW+FERp8FgXR
# GQ/YAavXzWjZhY+hIfP2JkQ38U+wtJPBVBajYfrbIYG+Dui4I4PCvHpQuPqFgqp1
# PzC/ZRX4pvP/ciZmUnthfAEP1HShTrY+2DE5qjzvZs7JIIgt0GCFD9ktx0LxxtRQ
# 7vllKluHWiKk6FxRPyUPxAAYH2Vy1lNM4kzekd8oEARzFAWgeW3az2xejEWLNN4e
# KGxDJ8WDl/FQUSntbjZ80FU3i54tpx5F/0Kr15zW/mJAxZMVBrTE2oi0fcI8VMbt
# oRAmaaslNXdCG1+lqvP4FbrQ6IwSBXkZagHLhFU9HCrG/syTRLLhAezu/3Lr00Gr
# JzPQFnCEH1Y58678IgmfORBPC1JKkYaEt2OdDh4GmO0/5cHelAK2/gTlQJINqDr6
# JfwyYHXSd+V08X1JUPvB4ILfJdmL+66Gp3CSBXG6IwXMZUXBhtCyIaehr0XkBoDI
# GMUG1dUtwq1qmcwbdUfcSYCn+OwncVUXf53VJUNOaMWMts0VlRYxe5nK+At+DI96
# HAlXHAL5SlfYxJ7La54i71McVWRP66bW+yERNpbJCjyCYG2j+bdpxo/1Cy4uPcU3
# AWVPGrbn5PhDBf3Froguzzhk++ami+r3Qrx5bIbY3TVzgiFI7Gq3zWcxggSbMIIE
# lwIBATBsMFcxCzAJBgNVBAYTAkdCMRgwFgYDVQQKEw9TZWN0aWdvIExpbWl0ZWQx
# LjAsBgNVBAMTJVNlY3RpZ28gUHVibGljIENvZGUgU2lnbmluZyBDQSBFViBFMzYC
# EQDi7iMpwUlypg+Lsc82RvD6MAkGBSsOAwIaBQCgeDAYBgorBgEEAYI3AgEMMQow
# CKACgAChAoAAMBkGCSqGSIb3DQEJAzEMBgorBgEEAYI3AgEEMBwGCisGAQQBgjcC
# AQsxDjAMBgorBgEEAYI3AgEVMCMGCSqGSIb3DQEJBDEWBBSUXmzEC2Sx4zd09jJH
# beLN9k5QfzALBgcqhkjOPQIBBQAEaDBmAjEAjYP1f3knTWI/18Mbh4b98gaEb6WH
# goD0GMPka2PpGvgPn9q1MqRBeDPldkRwgo0+AjEA9DOuVbBGCS+TQbGvaPAsF1P1
# QrcI7Q8KRTzbmIrwKUKw69/gp+nqGya22iyBA/8XoYIDJjCCAyIGCSqGSIb3DQEJ
# BjGCAxMwggMPAgEBMH0waTELMAkGA1UEBhMCVVMxFzAVBgNVBAoTDkRpZ2lDZXJ0
# LCBJbmMuMUEwPwYDVQQDEzhEaWdpQ2VydCBUcnVzdGVkIEc0IFRpbWVTdGFtcGlu
# ZyBSU0E0MDk2IFNIQTI1NiAyMDI1IENBMQIQCoDvGEuN8QWC0cR2p5V0aDANBglg
# hkgBZQMEAgEFAKBpMBgGCSqGSIb3DQEJAzELBgkqhkiG9w0BBwEwHAYJKoZIhvcN
# AQkFMQ8XDTI2MDMxMTEzMDIyN1owLwYJKoZIhvcNAQkEMSIEIIiCDBcFPOcExXTH
# aOq4BlB3hoCjJ0HLPsu/La38fmtYMA0GCSqGSIb3DQEBAQUABIICAKw+Un1QFlDQ
# wJ+IQceYRQgC2nDMeCZ+lkvlAz2DF/jIGZDy9pbXbWQ60uFHittTF/UcZ7+cadBA
# 0FeIoChSNIoaO4mqhBWbt83wiACTB7jn2mep2d54Fl+GFTPfYhsFPEZJNmEe/WgV
# NzQ4Hwva5OKf4xIsIxSQugfOQa0NZILKbQGF/TXcd2ODt44JFtSYsob6iqnDveF8
# kGCPYe/ZpcDnFK2aERqRcxMYSBkGFKnb2Q6NB1ryfSSgDE7KSG+73rbRe7+9WxXl
# 3K/yHUzV1R+zms/sHlJX4OW3TMWi1qyPMR3tEzJKqKL6N4GiflO4UyJ4AIixy5G6
# M5MiCNMW2Y0CvEPkmcQDxMgunD3H7UDtYDfMtOyadfANcS8YpyVCofFB0d3vCuWA
# NKIEBvynB49UDYN8Tib7uhm+WyZZB9AQgVpe4cb0EzevdOQS1Tk2KQJPa0S3AuQE
# V3/JL3mAVbNO4HeD4HgmulChdNaNPMLWnX6IoHCw8WPeMdN81CJgfm7EXHBRyFcP
# JfLuG0caIa+lLV7Nn33BBmCYM1Thobw62Q0DplUIuBjGERdWmzKRJ7K31Ac5lNn1
# KXugxqiv3wmGONpTq6kzEB8QrSva0W4BOpo/Yw4cUQxgXRt1ujuIrzCsivzdKpZD
# ut39qc2LefoSzVNh5r0Kt3KbRensZDji
# SIG # End signature block
