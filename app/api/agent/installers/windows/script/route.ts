import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/agent/installers/windows/script
 * 
 * Serves the PowerShell installer script with the registration token pre-filled.
 * This allows the console UI to provide a one-click download that includes the user's token.
 * 
 * Query Parameters:
 * - token: Registration token (base64 or JWT) - REQUIRED
 * 
 * Returns:
 * - PowerShell script (.ps1) with token embedded
 * - Browser downloads as: install-kuamini-windows-[timestamp].ps1
 */
export async function GET(request: NextRequest) {
  try {
    // Extract token from query parameters
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

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

    // Read the base installer script template
    const fs = require('fs')
    const path = require('path')
    const scriptPath = path.join(process.cwd(), 'public', 'tray', 'install-kuamini-windows-cli.ps1')
    
    let scriptContent: string
    try {
      scriptContent = fs.readFileSync(scriptPath, 'utf-8')
    } catch (error) {
      console.error('Failed to read installer script:', error)
      return NextResponse.json(
        { error: 'Installer script not found' },
        { status: 500 }
      )
    }

    // Replace the token parameter default or inject it
    // The script will use this token automatically if no -Token parameter is provided
    const tokenEmbeddedScript = scriptContent.replace(
      /param\(\s*\[Parameter\(Mandatory\s*=\s*\$false\)\]\s*\[string\]\$Token,/,
      `param(
    [Parameter(Mandatory = $false)]
    [string]$Token = "${token.replace(/"/g, '\\"')}",`
    )

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
    const filename = `install-kuamini-windows-${timestamp}.ps1`

    // Return script with proper headers
    return new NextResponse(tokenEmbeddedScript, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })

  } catch (error) {
    console.error('Error in Windows installer script endpoint:', error)
    return NextResponse.json(
      { error: 'Failed to generate installer script' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/agent/installers/windows/script
 * 
 * Alternative endpoint for generating installer script with token in request body.
 * Useful for more secure token transmission (not in URL).
 * 
 * Body:
 * - token: Registration token (base64 or JWT) - REQUIRED
 * 
 * Returns:
 * - PowerShell script (.ps1) with token embedded
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const token = body.token

    if (!token) {
      return NextResponse.json(
        { error: 'Missing required field: token' },
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

    // Read the base installer script template
    const fs = require('fs')
    const path = require('path')
    const scriptPath = path.join(process.cwd(), 'public', 'tray', 'install-kuamini-windows-cli.ps1')
    
    let scriptContent: string
    try {
      scriptContent = fs.readFileSync(scriptPath, 'utf-8')
    } catch (error) {
      console.error('Failed to read installer script:', error)
      return NextResponse.json(
        { error: 'Installer script not found' },
        { status: 500 }
      )
    }

    // Replace the token parameter default
    const tokenEmbeddedScript = scriptContent.replace(
      /param\(\s*\[Parameter\(Mandatory\s*=\s*\$false\)\]\s*\[string\]\$Token,/,
      `param(
    [Parameter(Mandatory = $false)]
    [string]$Token = "${token.replace(/"/g, '\\"')}",`
    )

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
    const filename = `install-kuamini-windows-${timestamp}.ps1`

    // Return script with proper headers
    return new NextResponse(tokenEmbeddedScript, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })

  } catch (error) {
    console.error('Error in Windows installer script POST endpoint:', error)
    return NextResponse.json(
      { error: 'Failed to generate installer script' },
      { status: 500 }
    )
  }
}
