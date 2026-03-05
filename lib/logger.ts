type LogLevel = "INFO" | "WARN" | "ERROR"
type LogMeta = Record<string, unknown>

export type ApiLogContext = {
  requestId?: string
  restaurantSlug?: string
  actorRole?: string
  route?: string
  latencyMs?: number
  statusCode?: number
}

export function log(
  level: LogLevel,
  message: string,
  meta?: LogMeta
) {
  const entry = {
    level,
    message,
    meta: meta ?? {},
    ts: new Date().toISOString(),
  }

  console.log(JSON.stringify(entry))
}

export async function logSystemEvent(
  action: string,
  meta?: LogMeta
) {
  log("INFO", `SYSTEM:${action}`, meta)
}

export function logApi(
  level: LogLevel,
  message: string,
  context?: ApiLogContext,
  meta?: LogMeta
) {
  log(level, message, {
    ...(context ?? {}),
    ...(meta ?? {}),
  })
}
