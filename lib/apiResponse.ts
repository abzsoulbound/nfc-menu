import { NextResponse } from "next/server"

type HeaderLike = {
  get: (key: string) => string | null
}

export function getRequestIdFromHeaders(headers: HeaderLike): string {
  const requestId = headers.get("x-request-id")?.trim()
  return requestId || crypto.randomUUID()
}

export function withRequestId<T>(
  payload: T,
  init: ResponseInit | undefined,
  requestId: string
) {
  const response = NextResponse.json(payload, init)
  response.headers.set("x-request-id", requestId)
  return response
}

export function jsonWithRequestId<T>(
  headers: HeaderLike,
  payload: T,
  init?: ResponseInit
) {
  return withRequestId(payload, init, getRequestIdFromHeaders(headers))
}

export function safeServerError(
  headers: HeaderLike,
  requestId?: string
) {
  const rid = requestId || getRequestIdFromHeaders(headers)
  return withRequestId(
    {
      error: "INTERNAL_SERVER_ERROR",
      requestId: rid,
    },
    { status: 500 },
    rid
  )
}
