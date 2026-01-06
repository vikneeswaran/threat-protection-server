/** @type {import('next').NextConfig} */
const nextConfig = {
  // Fix workspace root detection due to multiple lockfiles
  turbopack: {
    root: __dirname,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
