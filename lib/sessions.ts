import { log } from "@/lib/logger"

export function createSession(origin: "customer" | "staff") {
  const id = crypto.randomUUID()
  log("INFO", "Session created", { id, origin })
  return id
}

export function markSessionActive(sessionId: string) {
  log("INFO", "Session activity", { sessionId })
}

export function markSessionStale(sessionId: string) {
  log("WARN", "Session stale", { sessionId })
}