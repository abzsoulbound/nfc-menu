import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const startedAt = Date.now()
  const requestId = req.headers.get("x-request-id") ?? null

  try {
    await prisma.$queryRaw`SELECT 1`
    const latencyMs = Date.now() - startedAt

    return NextResponse.json({
      status: "ok",
      service: "nfc-menu",
      database: "up",
      latencyMs,
      timestamp: new Date().toISOString(),
      requestId,
    })
  } catch (error) {
    const latencyMs = Date.now() - startedAt
    const detail = error instanceof Error ? error.message : String(error)

    console.error("health_check_failed", {
      requestId,
      latencyMs,
      detail,
    })

    return NextResponse.json(
      {
        status: "degraded",
        service: "nfc-menu",
        database: "down",
        latencyMs,
        timestamp: new Date().toISOString(),
        requestId,
      },
      { status: 503 }
    )
  }
}
