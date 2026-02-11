type EditObject = Record<string, unknown>

function isObject(value: unknown): value is EditObject {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  )
}

function normalizeClientKey(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function cloneWithoutMeta(value: EditObject): EditObject {
  const clone: EditObject = { ...value }
  delete clone.__meta
  return clone
}

export function getEditClientKey(edits: unknown): string | null {
  if (!isObject(edits)) return null
  const meta = edits.__meta
  if (!isObject(meta)) return null
  return normalizeClientKey(meta.clientKey)
}

export function isEditConfirmed(edits: unknown): boolean {
  if (!isObject(edits)) return false
  const meta = edits.__meta
  if (!isObject(meta)) return false
  return meta.confirmed === true
}

export function withEditClientKey(
  edits: unknown,
  clientKey: unknown
): unknown {
  const normalizedKey = normalizeClientKey(clientKey)
  if (!normalizedKey) {
    return edits
  }

  const base: EditObject = isObject(edits) ? { ...edits } : {}
  const existingMeta = isObject(base.__meta)
    ? { ...base.__meta }
    : {}

  return {
    ...base,
    __meta: {
      ...existingMeta,
      clientKey: normalizedKey,
    },
  }
}

export function withEditConfirmation(
  edits: unknown,
  confirmed: boolean,
  clientKey?: unknown
): unknown {
  const normalizedKey = normalizeClientKey(clientKey)
  const hasObjectEdits = isObject(edits)

  if (!hasObjectEdits && edits == null && !normalizedKey) {
    return edits
  }

  const base: EditObject = hasObjectEdits ? { ...edits } : {}
  const existingMeta = isObject(base.__meta)
    ? { ...base.__meta }
    : {}

  if (normalizedKey) {
    existingMeta.clientKey = normalizedKey
  }

  if (confirmed) {
    existingMeta.confirmed = true
  } else {
    delete existingMeta.confirmed
  }

  if (Object.keys(existingMeta).length > 0) {
    base.__meta = existingMeta
  } else {
    delete base.__meta
  }

  if (Object.keys(base).length === 0) {
    return edits ?? null
  }

  return base
}

export function stripInternalEditMeta(
  edits: unknown
): unknown {
  if (!isObject(edits)) return edits
  const clone = cloneWithoutMeta(edits)
  return Object.keys(clone).length > 0 ? clone : null
}

export function hasVisibleEdits(edits: unknown): boolean {
  const visible = stripInternalEditMeta(edits)
  if (visible === null || visible === undefined) return false
  if (Array.isArray(visible)) return visible.length > 0
  if (typeof visible === "string") return visible.trim().length > 0
  if (isObject(visible)) return Object.keys(visible).length > 0
  return true
}

export function applyEditNote(
  edits: unknown,
  note: string | null | undefined,
  clientKey?: string | null
): unknown {
  const normalizedNote =
    typeof note === "string" ? note.trim() : ""

  const base = withEditClientKey(edits, clientKey)
  const objectBase: EditObject = isObject(base) ? { ...base } : {}

  if (normalizedNote.length === 0) {
    delete objectBase.note
  } else {
    objectBase.note = normalizedNote
  }

  const visible = stripInternalEditMeta(objectBase)
  if (!visible) {
    const retainedMeta = withEditClientKey(null, clientKey)
    return retainedMeta ?? null
  }

  return objectBase
}

export function getEditNote(edits: unknown): string {
  if (!isObject(edits)) return ""
  const note = edits.note
  return typeof note === "string" ? note : ""
}
