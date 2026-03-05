import { getRestaurantContextSlug } from "@/lib/tenantContext"

type RuntimeEventPayload = {
  type: string
  at: string
  payload?: Record<string, unknown>
}

type RuntimeListener = {
  id: string
  push: (data: string) => void
  close: () => void
}

const globalForRealtime = globalThis as unknown as {
  __NFC_RUNTIME_LISTENERS_BY_TENANT__?: Map<
    string,
    Map<string, RuntimeListener>
  >
}

function listenersForTenant(restaurantSlug: string) {
  if (!globalForRealtime.__NFC_RUNTIME_LISTENERS_BY_TENANT__) {
    globalForRealtime.__NFC_RUNTIME_LISTENERS_BY_TENANT__ =
      new Map()
  }
  const byTenant = globalForRealtime.__NFC_RUNTIME_LISTENERS_BY_TENANT__
  if (!byTenant.has(restaurantSlug)) {
    byTenant.set(restaurantSlug, new Map())
  }
  return byTenant.get(restaurantSlug)!
}

function encodeSseEvent(data: RuntimeEventPayload) {
  return `data: ${JSON.stringify(data)}\n\n`
}

export function publishRuntimeEvent(
  type: string,
  payload?: Record<string, unknown>,
  restaurantSlug?: string
) {
  const tenant = restaurantSlug ?? getRestaurantContextSlug()
  const event: RuntimeEventPayload = {
    type,
    at: new Date().toISOString(),
    payload,
  }
  const serialized = encodeSseEvent(event)
  const listeners = listenersForTenant(tenant)
  for (const listener of listeners.values()) {
    try {
      listener.push(serialized)
    } catch {
      try {
        listener.close()
      } catch {
        // ignore
      }
      listeners.delete(listener.id)
    }
  }
}

export function createRuntimeEventStream(restaurantSlug?: string) {
  const encoder = new TextEncoder()
  const id = crypto.randomUUID()
  const tenant = restaurantSlug ?? getRestaurantContextSlug()
  const listeners = listenersForTenant(tenant)

  const stream = new ReadableStream({
    start(controller) {
      const listener: RuntimeListener = {
        id,
        push: data => controller.enqueue(encoder.encode(data)),
        close: () => controller.close(),
      }

      listeners.set(id, listener)
      controller.enqueue(
        encoder.encode(
          encodeSseEvent({
            type: "connected",
            at: new Date().toISOString(),
          })
        )
      )
    },
    cancel() {
      listeners.delete(id)
    },
  })

  return stream
}
