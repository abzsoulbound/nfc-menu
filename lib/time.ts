export function elapsedMs(since: string) {
  return Date.now() - new Date(since).getTime()
}

export function minutes(ms: number) {
  return Math.floor(ms / 60000)
}

export function seconds(ms: number) {
  return Math.floor(ms / 1000)
}

export function contributionWindowRemaining(
  openedAt: string,
  windowMs = 5 * 60 * 1000
) {
  const used = elapsedMs(openedAt)
  return Math.max(0, windowMs - used)
}