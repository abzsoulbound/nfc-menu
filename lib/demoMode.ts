function isTruthy(value: string | undefined) {
  return value === "1" || value === "true"
}

export function isAuthDemoBypassEnabledFromEnv(
  value: string | undefined
) {
  return isTruthy(value)
}

export function getAutoRefreshMsFromEnv(
  value: string | undefined
) {
  const parsed = Number(value ?? "")
  if (!Number.isFinite(parsed) || parsed < 1000) {
    return 0
  }
  return Math.floor(parsed)
}

export function formatRefreshInterval(ms: number) {
  if (ms % 1000 === 0) {
    return `${ms / 1000}s`
  }
  return `${ms}ms`
}

export function getDemoModeBannerText(
  authBypassEnabled: boolean,
  autoRefreshMs: number
) {
  if (!authBypassEnabled) return ""
  return `Demo mode active: staff passcodes are temporarily disabled and pages auto-refresh${
    autoRefreshMs > 0
      ? ` every ${formatRefreshInterval(autoRefreshMs)}`
      : ""
  }. Passcodes will be re-enabled before launch.`
}

export function getDemoModeSettingsFromEnv() {
  const authBypassEnabled = isAuthDemoBypassEnabledFromEnv(
    process.env.AUTH_DEMO_BYPASS
  )
  const autoRefreshMs = getAutoRefreshMsFromEnv(
    process.env.DEMO_AUTO_REFRESH_MS ??
      process.env.NEXT_PUBLIC_AUTO_REFRESH_MS
  )

  return {
    authBypassEnabled,
    autoRefreshMs,
  }
}
