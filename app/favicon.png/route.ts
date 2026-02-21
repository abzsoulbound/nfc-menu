import { NextResponse } from 'next/server'

const pngBase64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO0p7f8AAAAASUVORK5CYII='

const pngBytes = Uint8Array.from(atob(pngBase64), (char) =>
  char.charCodeAt(0)
)

export const runtime = 'nodejs'

export async function GET() {
  return new NextResponse(pngBytes, {
    status: 200,
    headers: {
      'content-type': 'image/png',
      'cache-control': 'public, max-age=86400, s-maxage=86400',
    },
  })
}
