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
  __NFC_RUNTIME_LISTENERS__?: Map<string, RuntimeListener>
}

function listeners() {
  if (!globalForRealtime.__NFC_RUNTIME_LISTENERS__) {
    globalForRealtime.__NFC_RUNTIME_LISTENERS__ = new Map()
  }
  return globalForRealtime.__NFC_RUNTIME_LISTENERS__
}

function encodeSseEvent(data: RuntimeEventPayload) {
  return `data: ${JSON.stringify(data)}\n\n`
}

export function publishRuntimeEvent(
  type: string,
  payload?: Record<string, unknown>
) {
  const event: RuntimeEventPayload = {
    type,
    at: new Date().toISOString(),
    payload,
  }
  const serialized = encodeSseEvent(event)
  for (const listener of listeners().values()) {
    try {
      listener.push(serialized)
    } catch {
      try {
        listener.close()
      } catch {
        // ignore
      }
      listeners().delete(listener.id)
    }
  }
}

export function createRuntimeEventStream() {
  const encoder = new TextEncoder()
  const id = crypto.randomUUID()

  const stream = new ReadableStream({
    start(controller) {
      const listener: RuntimeListener = {
        id,
        push: data => controller.enqueue(encoder.encode(data)),
        close: () => controller.close(),
      }

      listeners().set(id, listener)
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
      listeners().delete(id)
    },
  })

  return stream
}

