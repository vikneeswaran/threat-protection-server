import path from 'path'
import { fileURLToPath } from 'url'

// Resolve ESM-friendly __dirname
const __dirnameESM = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Fix workspace root detection due to multiple lockfiles
  turbopack: {
    root: __dirnameESM,
  },
  typescript: {
    ignoreBuildErrors: true,
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
}

export default nextConfig
