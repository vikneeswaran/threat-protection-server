import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import fs from 'fs/promises'
import path from 'path'
import AdmZip from 'adm-zip'

/**
 * GET /api/agent/installers/windows
 * 
 * Downloads or generates Windows MSI installer with embedded account details.
 * 
 * Query Parameters:
 * - token: Registration token (base64 or JWT) - REQUIRED
 * - accountId: Account ID (UUID) - optional
 * 
 * Returns:
 * - Redirects to pre-built MSI in public/tray/
 * - Or: downloads dynamically generated MSI (future enhancement)
 */
export async function GET(request: NextRequest) {
  try {
    // Extract query parameters
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')
    const accountId = searchParams.get('accountId')

    if (!token) {
      return NextResponse.json(
        { error: 'Missing required parameter: token' },
        { status: 400 }
      )
    }

    // Validate token format (basic check)
    if (token.length < 20) {
      return NextResponse.json(
        { error: 'Invalid token format' },
        { status: 400 }
      )
    }

    // Log for audit purposes (accountId may be used for logging)
    console.info(`[Installer Download] Token: ${token.substring(0, 20)}..., Account: ${accountId || 'not-provided'}`)

    // Resolve MSI from public/tray (prefer latest version)
    const trayDir = path.join(process.cwd(), 'public', 'tray')
    const entries = await fs.readdir(trayDir)
    const msiFiles = entries
      .filter((name) => /^KuaminiSecurityClient-\d+\.\d+\.\d+(?:\.\d+)?\.msi$/u.test(name))
      .sort()
      .reverse()

    if (msiFiles.length === 0) {
      return NextResponse.json(
      { error: 'No Windows MSI found in public/tray' },
      { status: 404 }
      )
    }

    const msiFileName = msiFiles[0]
    const msiAbsolutePath = path.join(trayDir, msiFileName)
    const msiData = await fs.readFile(msiAbsolutePath)

    const installHelper = `#Requires -RunAsAdministrator
  param([switch]$Quiet)

  $ErrorActionPreference = "Stop"
  $scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
  $msiName   = "${msiFileName}"
  $msiPath   = Join-Path $scriptPath $msiName
  $tokenPath = Join-Path $scriptPath "registration.token"

  Write-Host "Kuamini Security Client Installer" -ForegroundColor Green
  Write-Host "-----------------------------------" -ForegroundColor Green

  if (!(Test-Path $tokenPath)) {
    Write-Host "ERROR: registration.token not found in $scriptPath" -ForegroundColor Red
    exit 1
  }

  $regToken = (Get-Content $tokenPath -Raw).Trim()
  if (-not $regToken) {
    Write-Host "ERROR: registration.token is empty" -ForegroundColor Red
    exit 1
  }

  if (!(Test-Path $msiPath)) {
    Write-Host "ERROR: Bundled MSI not found at $msiPath" -ForegroundColor Red
    exit 1
  }

  Write-Host "Installing Kuamini Security Client..." -ForegroundColor Yellow
  $msiArgs = @("/i", $msiPath, "REGISTRATION_TOKEN=$regToken", "/qn", "/l*v", (Join-Path $scriptPath "install.log"))
  $proc = Start-Process "msiexec.exe" -ArgumentList $msiArgs -Wait -PassThru -NoNewWindow
  if ($proc.ExitCode -ne 0) {
    Write-Host "Installation failed. Exit code: $($proc.ExitCode)" -ForegroundColor Red
    exit $proc.ExitCode
  }

  Write-Host "Installation complete!" -ForegroundColor Green
  `

    const readme = `Kuamini Security Client (Windows)
  =========================================
  1. Unzip this bundle.
  2. Run install-helper.ps1 as Administrator.

  This bundle contains:
  - ${msiFileName}
  - registration.token
  - install-helper.ps1
  `

    const zip = new AdmZip()
    zip.addFile(msiFileName, msiData)
    zip.addFile('registration.token', Buffer.from(token, 'utf-8'))
    zip.addFile('install-helper.ps1', Buffer.from(installHelper, 'utf-8'))
    zip.addFile('README.txt', Buffer.from(readme, 'utf-8'))
    const zipData = zip.toBuffer()

    const bundleName = `KuaminiSecurityClient-${(accountId || 'account').slice(0, 8)}-windows.zip`

    // 5. Log this download for audit purposes
    try {
      const supabase = await createClient()
      const session = await supabase.auth.getSession()
      
      if (session.data.session?.user) {
        // Log to audit trail
        console.info(
          `[Installer Download] User: ${session.data.session.user.email}, ` +
          `AccountId: ${accountId || 'not-provided'}, Token: ${token.substring(0, 20)}...`
        )
      }
    } catch (error) {
      console.error('Failed to log installer download:', error)
      // Don't fail the download, just log the error
    }

    // 6. Return ZIP bundle with token + helper + MSI
    return new NextResponse(new Uint8Array(zipData), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${bundleName}"`,
      },
    })

  } catch (error) {
    console.error('Error in Windows installer endpoint:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate installer',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/agent/installers/windows
 * 
 * Generates a custom MSI installer with embedded account details (future enhancement)
 * 
 * Body:
 * {
 *   "token": "base64-or-jwt-token",
 *   "accountId": "uuid",
 *   "accountName": "string",
 *   "consoleUrl": "https://...",
 *   "apiBaseUrl": "https://..."
 * }
 * 
 * Returns:
 * {
 *   "success": true,
 *   "msiUrl": "https://kuaminisystems.com/path/to/msi",
 *   "downloadToken": "temporary-token",
 *   "expiresIn": 3600
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, accountId } = body

    // Validate required fields
    if (!token || !accountId) {
      return NextResponse.json(
        { error: 'Missing required fields: token, accountId' },
        { status: 400 }
      )
    }

    // Future enhancement: Build MSI on-demand with embedded token
    // For now, return the GET endpoint URL with token as query param
    
    const installerUrl = new URL('/api/agent/installers/windows', request.url)
    installerUrl.searchParams.append('token', token)
    installerUrl.searchParams.append('accountId', accountId)

    return NextResponse.json({
      success: true,
      msiUrl: installerUrl.toString(),
      downloadToken: token,
      expiresIn: 3600,
      notes: 'MSI is pre-built and served with embedded configuration. Token is passed as query parameter.',
    })

  } catch (error) {
    console.error('Error in Windows installer POST:', error)
    return NextResponse.json(
      {
        error: 'Failed to process installer request',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
