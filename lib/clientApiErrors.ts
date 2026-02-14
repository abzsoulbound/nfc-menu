export type ApiErrorInfo = {
  status: number
  code: string | null
  message: string | null
  requestId: string | null
}

function asCustomerSafeTenantError(code: string | null) {
  return (
    code === "TENANT_CONTEXT_MISSING" ||
    code === "TENANT_CONTEXT_INVALID"
  )
}

export async function readApiErrorInfo(
  response: Response
): Promise<ApiErrorInfo> {
  let code: string | null = null
  let message: string | null = null
  let requestId: string | null = null

  const contentType = response.headers.get("content-type") ?? ""

  if (contentType.toLowerCase().includes("application/json")) {
    const payload = await response
      .json()
      .catch(() => null as Record<string, unknown> | null)

    if (payload && typeof payload.error === "string") {
      code = payload.error
    }
    if (payload && typeof payload.message === "string") {
      message = payload.message
    }
    if (payload && typeof payload.requestId === "string") {
      requestId = payload.requestId
    }
  }

  if (!requestId) {
    requestId = response.headers.get("x-request-id")
  }

  return {
    status: response.status,
    code,
    message,
    requestId: requestId || null,
  }
}

function withRequestHint(base: string, info: ApiErrorInfo) {
  if (!info.requestId) return base
  return `${base} Ref: ${info.requestId}`
}

export function sessionConnectErrorMessage(
  info: ApiErrorInfo,
  tagId: string
): string {
  switch (info.code) {
    case "TENANT_CONTEXT_MISSING":
    case "TENANT_CONTEXT_INVALID":
      return "This table link looks invalid. Ask staff for help."
    case "TAG_NOT_REGISTERED":
      return `NFC "${tagId}" is not registered. Ask staff to register this tag in Staff > Tags.`
    case "BAD_REQUEST":
      return `NFC "${tagId}" is invalid. Check the tag number and try again.`
    case "TABLE_CLOSED":
      return `Table ordering is closed for NFC "${tagId}". Ask staff to reseat this table.`
    default:
      return withRequestHint(
        "We couldn’t connect this table right now. Retry.",
        info
      )
  }
}

export function cartLoadErrorMessage(info: ApiErrorInfo): string {
  switch (info.code) {
    case "TENANT_CONTEXT_MISSING":
    case "TENANT_CONTEXT_INVALID":
      return "This table link looks invalid. Ask staff for help."
    case "SESSION_NOT_FOUND":
      return "This table session has expired. Scan again to continue."
    case "BAD_REQUEST":
      return "We couldn’t open your basket. Retry."
    default:
      return withRequestHint(
        "We couldn’t open your basket. Retry.",
        info
      )
  }
}

export function cartSyncErrorMessage(info: ApiErrorInfo): string {
  switch (info.code) {
    case "TENANT_CONTEXT_MISSING":
    case "TENANT_CONTEXT_INVALID":
      return "This table link looks invalid. Ask staff for help."
    case "ITEM_UNAVAILABLE":
      return "That item is unavailable right now."
    case "INVALID_MODIFIERS":
      return "That customization is no longer available."
    case "SESSION_NOT_FOUND":
      return "This table session has expired. Scan again to continue."
    case "ITEM_NOT_FOUND":
      return "That basket item no longer exists."
    case "ASSIST_LOCKED":
      return "This item is locked for assist edit right now."
    case "ITEM_CONFIRMED":
      return 'Your pending items are confirmed. Tap "Edit items" to unconfirm before editing.'
    default:
      return withRequestHint(
        "We couldn’t update your basket. Retry.",
        info
      )
  }
}

export function menuLoadErrorMessage(info: ApiErrorInfo): string {
  if (asCustomerSafeTenantError(info.code)) {
    return "This table link looks invalid. Ask staff for help."
  }
  return withRequestHint(
    "We couldn’t load the menu. Retry.",
    info
  )
}

export function networkErrorMessage(action: string): string {
  return `Network issue while trying to ${action}. Retry.`
}
