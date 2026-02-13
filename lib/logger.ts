type LogLevel = "INFO" | "WARN" | "ERROR"

export function log(
  level: LogLevel,
  message: string,
  meta?: Record<string, unknown>
) {
  const entry = {
    level,
    message,
    meta: meta ?? {},
    ts: new Date().toISOString(),
  }

  console.log(JSON.stringify(entry))
}

type RequestLogMeta = {
  requestId: string
  restaurantId: string
  staffUserId?: string | null
  [key: string]: unknown
}

export function logWithRequest(
  level: LogLevel,
  message: string,
  meta: RequestLogMeta
) {
  log(level, message, {
    ...meta,
    requestId: meta.requestId,
    restaurantId: meta.restaurantId,
    staffUserId: meta.staffUserId ?? null,
  })
}

export async function logSystemEvent(
  action: string,
  meta?: Record<string, unknown>
) {
  log("INFO", `SYSTEM:${action}`, meta)
}
