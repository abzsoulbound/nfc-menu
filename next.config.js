/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: [],
  },
  async redirects() {
    return [
      {
        source: "/t/:tagId",
        destination: "/order/t/:tagId",
        permanent: true,
      },
      {
        source: "/menu",
        destination: "/order/menu",
        permanent: true,
      },
      {
        source: "/t/:tagId/:path*",
        destination: "/order/t/:tagId/:path*",
        permanent: true,
      },
    ]
  },
}

module.exports = nextConfig
