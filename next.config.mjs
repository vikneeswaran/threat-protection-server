import path from 'path'
import { fileURLToPath } from 'url'

// Resolve ESM-friendly __dirname
const __dirnameESM = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // Type-checking is run separately in CI; skip it during build to save memory on t2.micro
    ignoreBuildErrors: true,
  },
  // Fix workspace root detection due to multiple lockfiles
  turbopack: {
    root: __dirnameESM,
  },
  images: {
    unoptimized: true,
  },
  // Disable Next.js dev indicator (the "N" icon in corner)
  devIndicators: {
    appIsrStatus: false,
    buildActivity: false,
    buildActivityPosition: 'bottom-right',
  },
  // AWS EC2 deployment configuration
  output: process.env.STANDALONE === 'true' ? 'standalone' : undefined,
  async redirects() {
    return [
      {
        source: '/securityagent',
        destination: '/securityAgent',
        permanent: false,
      },
      {
        source: '/securityagent/:path*',
        destination: '/securityAgent/:path*',
        permanent: false,
      },
    ]
  },
}

export default nextConfig
