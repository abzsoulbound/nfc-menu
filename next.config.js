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
        source: "/r/:restaurantSlug/t/:tagId",
        destination: "/order/r/:restaurantSlug/t/:tagId",
        permanent: true,
      },
      {
        source: "/menu",
        destination: "/order/menu",
        permanent: true,
      },
      {
        source: "/r/:restaurantSlug/menu",
        destination: "/order/r/:restaurantSlug/menu",
        permanent: true,
      },
      {
        source: "/t/:tagId/:path*",
        destination: "/order/t/:tagId/:path*",
        permanent: true,
      },
      {
        source: "/r/:restaurantSlug/t/:tagId/:path*",
        destination: "/order/r/:restaurantSlug/t/:tagId/:path*",
        permanent: true,
      },
    ]
  },
}

module.exports = nextConfig
