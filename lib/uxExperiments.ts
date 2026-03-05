import { createHash, randomUUID } from "crypto"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import type {
  CustomerUxConfig,
  UxExperimentAssignmentDTO,
  UxExperimentDTO,
  UxExperimentStatus,
  UxExperimentVariant,
  UxFunnelEventDTO,
  UxInsightsDTO,
} from "@/lib/types"

type UxExperimentRecord = UxExperimentDTO & {
  restaurantSlug: string
}

type UxAssignmentRecord = UxExperimentAssignmentDTO & {
  restaurantSlug: string
}

type UxEventRecord = UxFunnelEventDTO & {
  restaurantSlug: string
}

const globalForUx = globalThis as unknown as {
  __NFC_UX_EXPERIMENTS__?: UxExperimentRecord[]
  __NFC_UX_ASSIGNMENTS__?: UxAssignmentRecord[]
  __NFC_UX_EVENTS__?: UxEventRecord[]
}

function nowIso() {
  return new Date().toISOString()
}

function canUseDatabase() {
  const value = process.env.DATABASE_URL
  return typeof value === "string" && value.trim() !== ""
}

function uxExperimentsStore() {
  if (!globalForUx.__NFC_UX_EXPERIMENTS__) {
    globalForUx.__NFC_UX_EXPERIMENTS__ = []
  }
  return globalForUx.__NFC_UX_EXPERIMENTS__
}

function uxAssignmentsStore() {
  if (!globalForUx.__NFC_UX_ASSIGNMENTS__) {
    globalForUx.__NFC_UX_ASSIGNMENTS__ = []
  }
  return globalForUx.__NFC_UX_ASSIGNMENTS__
}

function uxEventsStore() {
  if (!globalForUx.__NFC_UX_EVENTS__) {
    globalForUx.__NFC_UX_EVENTS__ = []
  }
  return globalForUx.__NFC_UX_EVENTS__
}

function toStatus(value: unknown, fallback: UxExperimentStatus) {
  if (
    value === "DRAFT" ||
    value === "LIVE" ||
    value === "PAUSED" ||
    value === "ARCHIVED"
  ) {
    return value
  }
  return fallback
}

function toText(value: unknown, fallback: string, maxLength: number) {
  if (typeof value !== "string") return fallback
  const trimmed = value.trim()
  if (!trimmed) return fallback
  return trimmed.slice(0, maxLength)
}

function toNumber(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(min, Math.min(max, Number(parsed.toFixed(2))))
}

function sanitizeVariant(
  value: unknown,
  index: number
): UxExperimentVariant | null {
  if (!value || typeof value !== "object") return null
  const source = value as Record<string, unknown>
  const key = toText(source.key, `variant-${index + 1}`, 64)
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .toLowerCase()
  const label = toText(source.label, `Variant ${index + 1}`, 64)
  const weight = toNumber(source.weight, 1, 0.01, 100)
  const uxPatch =
    source.uxPatch && typeof source.uxPatch === "object"
      ? (source.uxPatch as Partial<CustomerUxConfig>)
      : undefined

  return {
    key,
    label,
    weight,
    uxPatch,
  }
}

function sanitizeVariants(value: unknown): UxExperimentVariant[] {
  if (!Array.isArray(value)) {
    return [
      {
        key: "control",
        label: "Control",
        weight: 1,
      },
    ]
  }

  const parsed = value
    .map((entry, index) => sanitizeVariant(entry, index))
    .filter((entry): entry is UxExperimentVariant => entry !== null)

  if (parsed.length === 0) {
    return [
      {
        key: "control",
        label: "Control",
        weight: 1,
      },
    ]
  }

  return parsed
}

function toExperimentDto(source: {
  id: string
  key: string
  name: string
  description: string | null
  status: string
  trafficPercent: number
  variants: unknown
  createdAt: Date | string
  updatedAt: Date | string
}): UxExperimentDTO {
  return {
    id: source.id,
    key: source.key,
    name: source.name,
    description: source.description,
    status: toStatus(source.status, "DRAFT"),
    trafficPercent: toNumber(source.trafficPercent, 100, 0, 100),
    variants: sanitizeVariants(source.variants),
    createdAt:
      typeof source.createdAt === "string"
        ? source.createdAt
        : source.createdAt.toISOString(),
    updatedAt:
      typeof source.updatedAt === "string"
        ? source.updatedAt
        : source.updatedAt.toISOString(),
  }
}

function hashFraction(seed: string) {
  const digest = createHash("sha256").update(seed).digest("hex")
  const sample = Number.parseInt(digest.slice(0, 12), 16)
  return sample / 0xffffffffffff
}

function pickVariant(input: {
  experiment: UxExperimentDTO
  sessionId: string
  restaurantSlug: string
}) {
  const trafficFraction = input.experiment.trafficPercent / 100
  const trafficRandom = hashFraction(
    `${input.restaurantSlug}:${input.experiment.key}:${input.sessionId}:traffic`
  )
  if (trafficRandom > trafficFraction) {
    const control =
      input.experiment.variants.find(variant => variant.key === "control") ??
      input.experiment.variants[0]
    return control
  }

  const totalWeight = input.experiment.variants.reduce(
    (sum, variant) => sum + Math.max(0.01, variant.weight),
    0
  )
  const bucket =
    hashFraction(
      `${input.restaurantSlug}:${input.experiment.key}:${input.sessionId}:bucket`
    ) * totalWeight

  let cursor = 0
  for (const variant of input.experiment.variants) {
    cursor += Math.max(0.01, variant.weight)
    if (bucket <= cursor) {
      return variant
    }
  }

  return input.experiment.variants[input.experiment.variants.length - 1]
}

function normalizeSessionId(value: unknown) {
  return toText(value, "", 128).replace(/[^a-zA-Z0-9._:-]+/g, "")
}

export async function listUxExperiments(input: {
  restaurantSlug: string
  status?: UxExperimentStatus
}) {
  if (canUseDatabase()) {
    const rows = await prisma.uxExperiment.findMany({
      where: {
        restaurantSlug: input.restaurantSlug,
        ...(input.status ? { status: input.status } : {}),
      },
      orderBy: [{ updatedAt: "desc" }],
    })
    return rows.map(toExperimentDto)
  }

  return uxExperimentsStore()
    .filter(row => {
      if (row.restaurantSlug !== input.restaurantSlug) return false
      if (input.status && row.status !== input.status) return false
      return true
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map(row => ({
      ...row,
    }))
}

export async function upsertUxExperiment(input: {
  restaurantSlug: string
  key: string
  name: string
  description?: string | null
  status: UxExperimentStatus
  trafficPercent: number
  variants: unknown
}) {
  const key = toText(input.key, "", 80)
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .toLowerCase()
  if (!key) {
    throw new Error("Experiment key is required")
  }

  const payload = {
    key,
    name: toText(input.name, key, 120),
    description:
      typeof input.description === "string"
        ? input.description.trim().slice(0, 280)
        : null,
    status: toStatus(input.status, "DRAFT"),
    trafficPercent: toNumber(input.trafficPercent, 100, 0, 100),
    variants: sanitizeVariants(input.variants),
  } satisfies {
    key: string
    name: string
    description: string | null
    status: UxExperimentStatus
    trafficPercent: number
    variants: UxExperimentVariant[]
  }

  if (canUseDatabase()) {
    const row = await prisma.uxExperiment.upsert({
      where: {
        restaurantSlug_key: {
          restaurantSlug: input.restaurantSlug,
          key: payload.key,
        },
      },
      update: {
        name: payload.name,
        description: payload.description,
        status: payload.status,
        trafficPercent: payload.trafficPercent,
        variants: payload.variants,
      },
      create: {
        restaurantSlug: input.restaurantSlug,
        key: payload.key,
        name: payload.name,
        description: payload.description,
        status: payload.status,
        trafficPercent: payload.trafficPercent,
        variants: payload.variants,
      },
    })
    return toExperimentDto(row)
  }

  const now = nowIso()
  const experiments = uxExperimentsStore()
  const existingIndex = experiments.findIndex(
    row =>
      row.restaurantSlug === input.restaurantSlug && row.key === payload.key
  )

  if (existingIndex >= 0) {
    const existing = experiments[existingIndex]
    const updated: UxExperimentRecord = {
      ...existing,
      name: payload.name,
      description: payload.description,
      status: payload.status,
      trafficPercent: payload.trafficPercent,
      variants: payload.variants,
      updatedAt: now,
    }
    experiments[existingIndex] = updated
    return {
      ...updated,
    }
  }

  const created: UxExperimentRecord = {
    id: randomUUID(),
    restaurantSlug: input.restaurantSlug,
    key: payload.key,
    name: payload.name,
    description: payload.description,
    status: payload.status,
    trafficPercent: payload.trafficPercent,
    variants: payload.variants,
    createdAt: now,
    updatedAt: now,
  }
  experiments.push(created)
  return {
    ...created,
  }
}

async function readExistingAssignment(input: {
  restaurantSlug: string
  experimentKey: string
  sessionId: string
}) {
  if (canUseDatabase()) {
    const row = await prisma.uxExperimentAssignment.findUnique({
      where: {
        restaurantSlug_experimentKey_sessionId: {
          restaurantSlug: input.restaurantSlug,
          experimentKey: input.experimentKey,
          sessionId: input.sessionId,
        },
      },
    })
    if (!row) return null
    return {
      experimentKey: row.experimentKey,
      variantKey: row.variantKey,
      sessionId: row.sessionId,
      assignedAt: row.assignedAt.toISOString(),
    } satisfies UxExperimentAssignmentDTO
  }

  const row = uxAssignmentsStore().find(
    entry =>
      entry.restaurantSlug === input.restaurantSlug &&
      entry.experimentKey === input.experimentKey &&
      entry.sessionId === input.sessionId
  )

  if (!row) return null
  return {
    experimentKey: row.experimentKey,
    variantKey: row.variantKey,
    sessionId: row.sessionId,
    assignedAt: row.assignedAt,
  } satisfies UxExperimentAssignmentDTO
}

export async function assignUxExperiment(input: {
  restaurantSlug: string
  experimentKey: string
  sessionId: string
}) {
  const sessionId = normalizeSessionId(input.sessionId)
  if (!sessionId) {
    throw new Error("sessionId is required")
  }

  const experimentKey = toText(input.experimentKey, "", 80)
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .toLowerCase()
  if (!experimentKey) {
    throw new Error("experimentKey is required")
  }

  const existing = await readExistingAssignment({
    restaurantSlug: input.restaurantSlug,
    experimentKey,
    sessionId,
  })

  const liveExperiments = await listUxExperiments({
    restaurantSlug: input.restaurantSlug,
    status: "LIVE",
  })
  const experiment = liveExperiments.find(item => item.key === experimentKey)
  if (!experiment) {
    return {
      assignment: existing,
      experiment: null,
      variant: null,
    }
  }

  if (existing) {
    const variant =
      experiment.variants.find(entry => entry.key === existing.variantKey) ??
      experiment.variants[0]
    return {
      assignment: existing,
      experiment,
      variant,
    }
  }

  const picked = pickVariant({
    experiment,
    sessionId,
    restaurantSlug: input.restaurantSlug,
  })
  const assignedAt = nowIso()

  if (canUseDatabase()) {
    const row = await prisma.uxExperimentAssignment.create({
      data: {
        restaurantSlug: input.restaurantSlug,
        experimentKey,
        sessionId,
        variantKey: picked.key,
      },
    })
    return {
      assignment: {
        experimentKey: row.experimentKey,
        variantKey: row.variantKey,
        sessionId: row.sessionId,
        assignedAt: row.assignedAt.toISOString(),
      } satisfies UxExperimentAssignmentDTO,
      experiment,
      variant: picked,
    }
  }

  const record: UxAssignmentRecord = {
    restaurantSlug: input.restaurantSlug,
    experimentKey,
    variantKey: picked.key,
    sessionId,
    assignedAt,
  }
  uxAssignmentsStore().push(record)

  return {
    assignment: {
      experimentKey,
      variantKey: picked.key,
      sessionId,
      assignedAt,
    } satisfies UxExperimentAssignmentDTO,
    experiment,
    variant: picked,
  }
}

export async function trackUxFunnelEvent(input: {
  restaurantSlug: string
  sessionId: string
  eventName: string
  page: string
  step: string
  experimentKey?: string | null
  variantKey?: string | null
  value?: number | null
  metadata?: Record<string, unknown> | null
  occurredAt?: string
}) {
  const sessionId = normalizeSessionId(input.sessionId)
  if (!sessionId) {
    throw new Error("sessionId is required")
  }

  const eventName = toText(input.eventName, "", 80)
  const page = toText(input.page, "", 80)
  const step = toText(input.step, "", 80)
  if (!eventName || !page || !step) {
    throw new Error("eventName, page, and step are required")
  }

  const experimentKey = input.experimentKey
    ? toText(input.experimentKey, "", 80)
    : null
  const assignment =
    experimentKey && !input.variantKey
      ? await readExistingAssignment({
          restaurantSlug: input.restaurantSlug,
          experimentKey,
          sessionId,
        })
      : null

  const variantKey =
    input.variantKey?.trim() || assignment?.variantKey || null
  const occurredAtRaw =
    typeof input.occurredAt === "string" ? input.occurredAt : nowIso()
  const occurredAt = new Date(occurredAtRaw)

  if (Number.isNaN(occurredAt.getTime())) {
    throw new Error("occurredAt must be a valid date")
  }

  if (canUseDatabase()) {
    const row = await prisma.uxFunnelEvent.create({
      data: {
        restaurantSlug: input.restaurantSlug,
        sessionId,
        experimentKey,
        variantKey,
        eventName,
        page,
        step,
        value:
          typeof input.value === "number" && Number.isFinite(input.value)
            ? input.value
            : null,
        metadata:
          (input.metadata as Prisma.InputJsonValue | undefined) ??
          undefined,
        occurredAt,
      },
    })

    return {
      id: row.id,
      experimentKey: row.experimentKey,
      variantKey: row.variantKey,
      sessionId: row.sessionId,
      eventName: row.eventName,
      page: row.page,
      step: row.step,
      value: row.value,
      metadata:
        row.metadata && typeof row.metadata === "object"
          ? (row.metadata as Record<string, unknown>)
          : null,
      occurredAt: row.occurredAt.toISOString(),
    } satisfies UxFunnelEventDTO
  }

  const record: UxEventRecord = {
    id: randomUUID(),
    restaurantSlug: input.restaurantSlug,
    sessionId,
    experimentKey,
    variantKey,
    eventName,
    page,
    step,
    value:
      typeof input.value === "number" && Number.isFinite(input.value)
        ? input.value
        : null,
    metadata: input.metadata ?? null,
    occurredAt: occurredAt.toISOString(),
  }
  uxEventsStore().push(record)

  return {
    id: record.id,
    experimentKey: record.experimentKey,
    variantKey: record.variantKey,
    sessionId: record.sessionId,
    eventName: record.eventName,
    page: record.page,
    step: record.step,
    value: record.value,
    metadata: record.metadata,
    occurredAt: record.occurredAt,
  } satisfies UxFunnelEventDTO
}

export async function getUxInsights(input: {
  restaurantSlug: string
  experimentKey: string
  since: Date
  until: Date
}) {
  const experimentKey = toText(input.experimentKey, "", 80)
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .toLowerCase()
  if (!experimentKey) {
    throw new Error("experimentKey is required")
  }

  const sinceIso = input.since.toISOString()
  const untilIso = input.until.toISOString()

  const assignmentRows = canUseDatabase()
    ? await prisma.uxExperimentAssignment.findMany({
        where: {
          restaurantSlug: input.restaurantSlug,
          experimentKey,
          assignedAt: {
            gte: input.since,
            lte: input.until,
          },
        },
      })
    : uxAssignmentsStore().filter(entry => {
        if (entry.restaurantSlug !== input.restaurantSlug) return false
        if (entry.experimentKey !== experimentKey) return false
        return entry.assignedAt >= sinceIso && entry.assignedAt <= untilIso
      })

  const eventRows = canUseDatabase()
    ? await prisma.uxFunnelEvent.findMany({
        where: {
          restaurantSlug: input.restaurantSlug,
          experimentKey,
          occurredAt: {
            gte: input.since,
            lte: input.until,
          },
        },
      })
    : uxEventsStore().filter(entry => {
        if (entry.restaurantSlug !== input.restaurantSlug) return false
        if (entry.experimentKey !== experimentKey) return false
        return entry.occurredAt >= sinceIso && entry.occurredAt <= untilIso
      })

  const assignmentBySession = new Map<string, string>()
  for (const assignment of assignmentRows) {
    assignmentBySession.set(
      assignment.sessionId,
      assignment.variantKey
    )
  }

  const eventCountsByVariant = new Map<string, Record<string, number>>()
  for (const event of eventRows) {
    const variantKey =
      ("variantKey" in event && event.variantKey) ||
      assignmentBySession.get(event.sessionId) ||
      "unassigned"
    const bucket = eventCountsByVariant.get(variantKey) ?? {}
    bucket[event.eventName] = (bucket[event.eventName] ?? 0) + 1
    eventCountsByVariant.set(variantKey, bucket)
  }

  const sessionCountsByVariant = new Map<string, number>()
  for (const assignment of assignmentRows) {
    const key = assignment.variantKey
    sessionCountsByVariant.set(key, (sessionCountsByVariant.get(key) ?? 0) + 1)
  }

  const variants = Array.from(
    new Set([
      ...Array.from(sessionCountsByVariant.keys()),
      ...Array.from(eventCountsByVariant.keys()),
    ])
  ).map(variantKey => ({
    variantKey,
    sessions: sessionCountsByVariant.get(variantKey) ?? 0,
    eventCounts: eventCountsByVariant.get(variantKey) ?? {},
  }))

  return {
    experimentKey,
    since: sinceIso,
    until: untilIso,
    totalSessions: assignmentBySession.size,
    totalEvents: eventRows.length,
    variants,
  } satisfies UxInsightsDTO
}
