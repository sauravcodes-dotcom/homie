import type { NextConfig } from 'next'

// In local dev the browser talks to Next only; Next forwards /api to FastAPI so
// the session cookie stays same-origin. On Vercel, vercel.json routes /api to the
// backend service instead, so no rewrite is added there unless API_PROXY is set.
const apiProxy =
  process.env.API_PROXY ?? (process.env.NODE_ENV === 'development' ? 'http://localhost:8000' : '')

const config: NextConfig = {
  turbopack: { root: process.cwd() },
  async rewrites() {
    return apiProxy ? [{ source: '/api/:path*', destination: `${apiProxy}/api/:path*` }] : []
  },
}

export default config
