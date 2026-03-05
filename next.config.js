const distDir = process.env.NEXT_DIST_DIR?.trim() || ".next-build"

/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir,
  images: {
    domains: [],
  },
  async headers() {
    const scriptSrc = [
      "'self'",
      "'unsafe-inline'",
      "https://js.stripe.com",
    ]
    if (process.env.NODE_ENV !== "production") {
      scriptSrc.push("'unsafe-eval'")
    }

    const csp = [
      "default-src 'self'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data: https:",
      "style-src 'self' 'unsafe-inline'",
      `script-src ${scriptSrc.join(" ")}`,
      "connect-src 'self' https: wss:",
      "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
      "form-action 'self'",
    ].join("; ")

    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: csp,
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig
