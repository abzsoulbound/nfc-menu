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
        destination: "/order/t/:tagId?restaurantSlug=:restaurantSlug",
        permanent: true,
      },
      {
        source: "/order/r/:restaurantSlug/t/:tagId",
        destination: "/order/t/:tagId?restaurantSlug=:restaurantSlug",
        permanent: true,
      },
      {
        source: "/menu",
        destination: "/order/menu",
        permanent: true,
      },
      {
        source: "/r/:restaurantSlug/menu",
        destination: "/order/menu?restaurantSlug=:restaurantSlug",
        permanent: true,
      },
      {
        source: "/order/r/:restaurantSlug/menu",
        destination: "/order/menu?restaurantSlug=:restaurantSlug",
        permanent: true,
      },
      {
        source: "/t/:tagId/:path*",
        destination: "/order/t/:tagId/:path*",
        permanent: true,
      },
      {
        source: "/r/:restaurantSlug/t/:tagId/:path*",
        destination:
          "/order/t/:tagId/:path*?restaurantSlug=:restaurantSlug",
        permanent: true,
      },
      {
        source: "/order/r/:restaurantSlug/t/:tagId/:path*",
        destination:
          "/order/t/:tagId/:path*?restaurantSlug=:restaurantSlug",
        permanent: true,
      },
    ]
  },
}

module.exports = nextConfig
