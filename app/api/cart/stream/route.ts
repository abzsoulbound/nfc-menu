export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { Pool, type PoolClient } from "pg"
import { prisma } from "@/lib/prisma"

const globalForPool = globalThis as unknown as {
  cartStreamPool?: Pool
}

function getPool() {
  if (!globalForPool.cartStreamPool) {
    const connectionString =
      process.env.DATABASE_URL_UNPOOLED ??
      process.env.POSTGRES_URL_NON_POOLING ??
      process.env.DATABASE_URL

    if (!connectionString) {
      throw new Error("DATABASE_URL_UNPOOLED is missing")
    }

    globalForPool.cartStreamPool = new Pool({
      connectionString,
      max: 100,  // Realistic max capacity for single location
      idleTimeoutMillis: 60000,
      connectionTimeoutMillis: 10000,
      ssl: { rejectUnauthorized: false },  // Fix SSL warning
    })
  }

  return globalForPool.cartStreamPool
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const sessionId = searchParams.get("sessionId")?.trim()
  const restaurantId = req.headers.get("x-restaurant-id")?.trim()

  if (!sessionId) {
    return new Response("Missing sessionId", { status: 400 })
  }
  if (!restaurantId) {
    return new Response("Missing restaurant context", { status: 400 })
  }

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { restaurantId: true },
  })
  if (!session || session.restaurantId !== restaurantId) {
    return new Response("Session not found", { status: 404 })
  }

  let client: PoolClient | null = null
  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        // Guard pool acquisition to avoid dangling clients when connect races the timeout.
        const activeClient = await new Promise<PoolClient>(
          (resolve, reject) => {
            let settled = false
            const timeoutHandle = setTimeout(() => {
              if (settled) return
              settled = true
              reject(new Error("Connection pool timeout"))
            }, 5000)

            getPool()
              .connect()
              .then(connectedClient => {
                if (settled) {
                  connectedClient.release()
                  return
                }
                settled = true
                clearTimeout(timeoutHandle)
                resolve(connectedClient)
              })
              .catch(error => {
                if (settled) return
                settled = true
                clearTimeout(timeoutHandle)
                reject(error)
              })
          }
        )
        client = activeClient
        await activeClient.query("LISTEN cart_updates")

        const onNotification = (message: { payload?: string | null }) => {
          if (!message.payload) return
          let payload: { sessionId?: string } | null = null
          try {
            payload = JSON.parse(message.payload)
          } catch {
            return
          }

          if (payload?.sessionId !== sessionId) return
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(payload)}\n\n`)
          )
        }

        activeClient.on("notification", onNotification)

        let keepAliveTimer: ReturnType<typeof setTimeout> | null = null
        const schedulePing = () => {
          keepAliveTimer = setTimeout(() => {
            controller.enqueue(encoder.encode(": ping\n\n"))
            schedulePing()
          }, 25000)
        }
        schedulePing()

        const abort = () => {
          if (keepAliveTimer) {
            clearTimeout(keepAliveTimer)
            keepAliveTimer = null
          }
          activeClient.removeListener("notification", onNotification)
          void activeClient.query("UNLISTEN cart_updates")
          activeClient.release()
          controller.close()
        }

        req.signal.addEventListener("abort", abort, { once: true })
      } catch (error) {
        client?.release()
        controller.error(error)
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}
