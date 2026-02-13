export type ApiErrorInfo = {
  status: number
  code: string | null
  detail: string | null
  raw: string | null
}

function trimRaw(text: string): string | null {
  const trimmed = text.trim()
  if (!trimmed) return null
  return trimmed.length > 240
    ? `${trimmed.slice(0, 237)}...`
    : trimmed
}

export async function readApiErrorInfo(
  response: Response
): Promise<ApiErrorInfo> {
  let code: string | null = null
  let detail: string | null = null
  let raw: string | null = null

  const contentType = response.headers.get("content-type") ?? ""

  if (contentType.toLowerCase().includes("application/json")) {
    const payload = await response
      .json()
      .catch(() => null as Record<string, unknown> | null)

    if (payload && typeof payload.error === "string") {
      code = payload.error
    }
    if (payload && typeof payload.detail === "string") {
      detail = payload.detail
    } else if (payload && typeof payload.message === "string") {
      detail = payload.message
    }

    if (!code && !detail && payload) {
      raw = trimRaw(JSON.stringify(payload))
    }
  } else {
    raw = trimRaw(await response.text().catch(() => ""))
  }

  return {
    status: response.status,
    code,
    detail,
    raw,
  }
}

function httpLabel(info: ApiErrorInfo) {
  if (info.code) {
    return `HTTP ${info.status} (${info.code})`
  }
  return `HTTP ${info.status}`
}

function withDetail(base: string, info: ApiErrorInfo) {
  if (info.detail) return `${base} ${info.detail}`
  if (info.raw) return `${base} ${info.raw}`
  return base
}

export function sessionConnectErrorMessage(
  info: ApiErrorInfo,
  tagId: string
): string {
  switch (info.code) {
    case "TAG_NOT_REGISTERED":
      return `NFC "${tagId}" is not registered. Ask staff to register this tag in Staff > Tags.`
    case "BAD_REQUEST":
      return `NFC "${tagId}" is invalid. Check the tag number and try again.`
    case "TABLE_CLOSED":
      return `Table ordering is closed for NFC "${tagId}". Ask staff to reseat this table.`
    default:
      return withDetail(
        `Could not connect this table (${httpLabel(info)}).`,
        info
      )
  }
}

export function cartLoadErrorMessage(info: ApiErrorInfo): string {
  switch (info.code) {
    case "SESSION_NOT_FOUND":
      return "Session not found. Reload this NFC tag to start a new table session."
    case "BAD_REQUEST":
      return "Cart request was invalid. Reload this table and try again."
    default:
      return withDetail(
        `Could not load cart (${httpLabel(info)}).`,
        info
      )
  }
}

export function cartSyncErrorMessage(info: ApiErrorInfo): string {
  switch (info.code) {
    case "ITEM_UNAVAILABLE":
      return "That item is unavailable right now."
    case "INVALID_MODIFIERS":
      return withDetail("Invalid item edit.", info)
    case "SESSION_NOT_FOUND":
      return "Session not found while syncing cart. Reload this table."
    case "ITEM_NOT_FOUND":
      return "Cart item no longer exists. Refreshing your cart now."
    case "ASSIST_LOCKED":
      return "This item is locked for assist edit right now."
    case "ITEM_CONFIRMED":
      return 'Your pending items are confirmed. Tap "Edit items" to unconfirm before editing.'
    default:
      return withDetail(
        `Could not sync cart (${httpLabel(info)}).`,
        info
      )
  }
}

export function menuLoadErrorMessage(info: ApiErrorInfo): string {
  return withDetail(
    `Could not load menu (${httpLabel(info)}).`,
    info
  )
}

export function networkErrorMessage(action: string): string {
  return `Network error while trying to ${action}. Check internet and retry.`
}
