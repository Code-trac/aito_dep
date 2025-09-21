/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  images: { unoptimized: true },
  reactStrictMode: true,

  async rewrites() {
    return [
      // api group (covers /api/*)
      { source: '/api/:path*',      destination: 'http://localhost:5000/api/:path*' },

      // auth (signup/login)
      { source: '/auth/:path*',     destination: 'http://localhost:5000/auth/:path*' },

      // official endpoints (status, takeover, prediction etc)
      { source: '/official/:path*', destination: 'http://localhost:5000/official/:path*' },

      // alerts: both bare /alerts and /alerts/*
      { source: '/alerts',          destination: 'http://localhost:5000/alerts' },
      { source: '/alerts/:path*',   destination: 'http://localhost:5000/alerts/:path*' },

      // camera preview (both /camera and /camera/preview)
      { source: '/camera',         destination: 'http://localhost:5000/camera' },
      { source: '/camera/:path*',  destination: 'http://localhost:5000/camera/:path*' },

      // admin endpoints (enroll_official)
      { source: '/admin/:path*',   destination: 'http://localhost:5000/admin/:path*' },

      // user status (bare and subpaths)
      { source: '/user/status',     destination: 'http://localhost:5000/user/status' },
      { source: '/user/:path*',     destination: 'http://localhost:5000/user/:path*' },

      // fallback: if you add other top-level routes on backend, map them here
    ];
  }
};

export default nextConfig;
