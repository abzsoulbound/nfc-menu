type LogLevel = "INFO" | "WARN" | "ERROR"

export function log(
  level: LogLevel,
  message: string,
  meta?: Record<string, any>
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
  meta?: Record<string, any>
) {
  log("INFO", `SYSTEM:${action}`, meta)
}
