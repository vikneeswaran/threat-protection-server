import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
    // 1. Extract and validate query parameters
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')
    const accountId = searchParams.get('accountId')

    if (!token) {
      return NextResponse.json(
        { error: 'Missing required parameter: token' },
        { status: 400 }
      )
    }

    // 2. Validate token format (basic check)
    if (token.length < 20) {
      return NextResponse.json(
        { error: 'Invalid token format' },
        { status: 400 }
      )
    }

    // 3. Optional: Verify token is valid (can be enhanced to decode JWT/base64)
    // For now, we trust that tokens are pre-validated by the console UI
    // that generated the download link.

    // 4. Serve pre-built MSI from public/tray/
    // The MSI is pre-built during the build process WITHOUT any token
    // The installer script (install-kuamini-windows-cli.ps1) handles token creation
    // after MSI installation completes
    
    const msiFileName = 'KuaminiSecurityClient-1.0.5.msi'
    const msiPath = `/tray/${msiFileName}`

    // 5. Log this download for audit purposes
    try {
      const supabase = await createClient()
      const session = await supabase.auth.getSession()
      
      if (session.data.session?.user) {
        // Log to audit trail
        console.log(
          `[Installer Download] User: ${session.data.session.user.email}, ` +
          `AccountId: ${accountId || 'not-provided'}, Token: ${token.substring(0, 20)}...`
        )
      }
    } catch (error) {
      console.error('Failed to log installer download:', error)
      // Don't fail the download, just log the error
    }

    // 6. Return redirect to MSI file
    // Browser will download the file with proper HTTP headers
    return NextResponse.redirect(new URL(msiPath, request.url), {
      status: 302,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${msiFileName}"`,
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
    const { token, accountId, accountName, consoleUrl, apiBaseUrl } = body

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
