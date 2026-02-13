"use client"

type OrderPayload = {
  sessionId?: string
  tagId: string
  clientKey?: string
  items: Array<{
    itemId?: string
    menuItemId?: string
    name: string
    quantity: number
    edits?: unknown
    allergens?: string[]
    unitPrice?: number
    vatRate?: number
    station?: "KITCHEN" | "BAR"
  }>
}

type QueuedOrder = {
  id: string
  payload: OrderPayload
  queuedAt: number
  attempts: number
}

const inMemoryQueue: QueuedOrder[] = []

function readQueue(): QueuedOrder[] {
  return [...inMemoryQueue]
}

function writeQueue(queue: QueuedOrder[]) {
  inMemoryQueue.length = 0
  inMemoryQueue.push(...queue)
}

export function queueOrderSubmission(payload: OrderPayload) {
  const queue = readQueue()
  queue.push({
    id: crypto.randomUUID(),
    payload,
    queuedAt: Date.now(),
    attempts: 0,
  })
  writeQueue(queue)
}

export function queuedOrderCount() {
  return readQueue().length
}

export async function flushQueuedOrders() {
  if (typeof window === "undefined") return { sent: 0, remaining: 0 }
  if (!navigator.onLine) {
    return { sent: 0, remaining: readQueue().length }
  }

  const queue = readQueue()
  if (queue.length === 0) return { sent: 0, remaining: 0 }

  const nextQueue: QueuedOrder[] = []
  let sent = 0

  for (const job of queue) {
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(job.payload),
      })

      if (res.ok) {
        sent += 1
      } else {
        nextQueue.push({
          ...job,
          attempts: job.attempts + 1,
        })
      }
    } catch {
      nextQueue.push({
        ...job,
        attempts: job.attempts + 1,
      })
    }
  }

  writeQueue(nextQueue)
  return { sent, remaining: nextQueue.length }
}
