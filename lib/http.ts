import { NextResponse } from "next/server"
import type { ApiErrorEnvelope } from "@/lib/types"

function generateRequestId() {
  try {
    return crypto.randomUUID()
  } catch {
    return `req-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  }
}

export function getRequestId(req?: Request) {
  const candidate = req?.headers.get("x-request-id")?.trim()
  if (candidate && candidate.length > 0 && candidate.length <= 128) {
    return candidate
  }
  return generateRequestId()
}

function withRequestIdHeader(init: ResponseInit | undefined, requestId: string): ResponseInit {
  const headers = new Headers(init?.headers)
  headers.set("x-request-id", requestId)
  return {
    ...init,
    headers,
  }
}

export function ok<T>(data: T, init?: ResponseInit, req?: Request) {
  const requestId = getRequestId(req)
  return NextResponse.json(data, withRequestIdHeader(init, requestId))
}

export function badRequest(
  message: string,
  status = 400,
  options?: {
    code?: string
    details?: unknown
    headers?: HeadersInit
    req?: Request
  }
) {
  const requestId = getRequestId(options?.req)
  const payload: ApiErrorEnvelope & { error: string } = {
    code: options?.code ?? "BAD_REQUEST",
    message,
    requestId,
    error: message,
  }

  if (options?.details !== undefined) {
    payload.details = options.details
  }

  return NextResponse.json(
    payload,
    withRequestIdHeader(
      {
        status,
        headers: options?.headers,
      },
      requestId
    )
  )
}

export function unauthorized(
  message = "Unauthorized",
  options?: {
    code?: string
    details?: unknown
    headers?: HeadersInit
    req?: Request
  }
) {
  return badRequest(message, 401, {
    code: options?.code ?? "UNAUTHORIZED",
    details: options?.details,
    headers: options?.headers,
    req: options?.req,
  })
}

export async function readJson<T>(req: Request) {
  try {
    return (await req.json()) as T
  } catch {
    throw new Error("Invalid JSON body")
  }
}
