import type {
  CustomerUxConfig,
  UxExperimentAssignmentDTO,
  UxExperimentVariant,
} from "@/lib/types"

const UX_GUEST_SESSION_KEY = "nfc-pos.ux.session.v1"
const UX_ASSIGNMENTS_KEY = "nfc-pos.ux.assignments.v1"

type AssignmentCacheEntry = {
  experimentKey: string
  sessionId: string
  variantKey: string
  assignedAt: string
  uxPatch?: Partial<CustomerUxConfig>
}

type AssignmentApiResponse = {
  assignment: UxExperimentAssignmentDTO | null
  variant: UxExperimentVariant | null
}

function hasWindow() {
  return typeof window !== "undefined"
}

function randomId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function parseAssignmentCache() {
  if (!hasWindow()) return [] as AssignmentCacheEntry[]
  const raw = window.localStorage.getItem(UX_ASSIGNMENTS_KEY)
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(entry => {
      if (!entry || typeof entry !== "object") return false
      const candidate = entry as Partial<AssignmentCacheEntry>
      return (
        typeof candidate.experimentKey === "string" &&
        typeof candidate.sessionId === "string" &&
        typeof candidate.variantKey === "string" &&
        typeof candidate.assignedAt === "string"
      )
    }) as AssignmentCacheEntry[]
  } catch {
    return []
  }
}

function persistAssignmentCache(entries: AssignmentCacheEntry[]) {
  if (!hasWindow()) return
  window.localStorage.setItem(
    UX_ASSIGNMENTS_KEY,
    JSON.stringify(entries.slice(-50))
  )
}

export function getOrCreateUxSessionId() {
  if (!hasWindow()) return ""
  const existing = window.localStorage
    .getItem(UX_GUEST_SESSION_KEY)
    ?.trim()
  if (existing) return existing

  const created = `ux-${randomId()}`
  window.localStorage.setItem(UX_GUEST_SESSION_KEY, created)
  return created
}

export function readCachedAssignment(input: {
  experimentKey: string
  sessionId: string
}) {
  const entries = parseAssignmentCache()
  return (
    entries.find(
      entry =>
        entry.experimentKey === input.experimentKey &&
        entry.sessionId === input.sessionId
    ) ?? null
  )
}

export async function assignUxExperimentClient(input: {
  sessionId: string
  experimentKey: string
}) {
  if (!input.sessionId || !input.experimentKey) {
    return null
  }

  const cached = readCachedAssignment(input)
  if (cached) {
    return cached
  }

  const res = await fetch("/api/ux/assignment", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      sessionId: input.sessionId,
      experimentKey: input.experimentKey,
    }),
  })

  if (!res.ok) {
    return null
  }

  const payload = (await res.json()) as AssignmentApiResponse
  if (!payload.assignment || !payload.variant) {
    return null
  }

  const entry: AssignmentCacheEntry = {
    experimentKey: payload.assignment.experimentKey,
    sessionId: payload.assignment.sessionId,
    variantKey: payload.assignment.variantKey,
    assignedAt: payload.assignment.assignedAt,
    uxPatch: payload.variant.uxPatch,
  }

  const existing = parseAssignmentCache().filter(
    cachedEntry =>
      !(
        cachedEntry.experimentKey === entry.experimentKey &&
        cachedEntry.sessionId === entry.sessionId
      )
  )
  existing.push(entry)
  persistAssignmentCache(existing)
  return entry
}

export async function trackUxFunnelEventClient(input: {
  sessionId: string
  eventName: string
  page: string
  step: string
  experimentKey?: string
  variantKey?: string
  value?: number
  metadata?: Record<string, unknown>
}) {
  if (!input.sessionId || !input.eventName || !input.page || !input.step) {
    return
  }

  const cached =
    input.experimentKey && !input.variantKey
      ? readCachedAssignment({
          experimentKey: input.experimentKey,
          sessionId: input.sessionId,
        })
      : null

  await fetch("/api/ux/events", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      sessionId: input.sessionId,
      eventName: input.eventName,
      page: input.page,
      step: input.step,
      experimentKey: input.experimentKey,
      variantKey: input.variantKey ?? cached?.variantKey,
      value: input.value,
      metadata: input.metadata,
    }),
  }).catch(() => {
    // Non-blocking analytics path.
  })
}
