import { create } from "zustand"

type SessionState = {
  sessionId: string | null
  clientKey: string | null
  origin: "customer" | "staff" | null
  setSession: (id: string, origin: "customer" | "staff") => void
  clearSession: () => void
  hydrate: () => void
  ensureClientKey: () => string | null
  ensureSession: (tagId?: string) => Promise<string | null>
}

const SESSION_STORAGE_KEY = "nfc-session-v1"

type StoredSessionState = {
  sessionId: string | null
  clientKey: string | null
  origin: "customer" | "staff" | null
}

function persistState(input: StoredSessionState) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify(input)
    )
  } catch {
    // Ignore storage write failures.
  }
}

function readPersistedState(): StoredSessionState | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<StoredSessionState>
    return {
      sessionId:
        typeof parsed.sessionId === "string" && parsed.sessionId.trim().length > 0
          ? parsed.sessionId
          : null,
      clientKey:
        typeof parsed.clientKey === "string" && parsed.clientKey.trim().length > 0
          ? parsed.clientKey
          : null,
      origin:
        parsed.origin === "customer" || parsed.origin === "staff"
          ? parsed.origin
          : null,
    }
  } catch {
    return null
  }
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessionId: null,
  clientKey: null,
  origin: null,
  setSession: (id, origin) =>
    set(current => {
      const next = {
        sessionId: id,
        clientKey: current.clientKey,
        origin,
      }
      persistState(next)
      return next
    }),
  clearSession: () =>
    set(() => {
      const next = { sessionId: null, clientKey: null, origin: null }
      persistState(next)
      return next
    }),
  hydrate: () => {
    const persisted = readPersistedState()
    if (!persisted) return
    set(current => ({
      sessionId: persisted.sessionId ?? current.sessionId,
      clientKey: persisted.clientKey ?? current.clientKey,
      origin: persisted.origin ?? current.origin,
    }))
  },
  ensureClientKey: () => {
    const existing = get().clientKey
    if (existing) return existing
    if (typeof window === "undefined") return null

    const next =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `client-${Date.now().toString(36)}-${Math.random()
            .toString(36)
            .slice(2, 10)}`

    set(current => {
      const nextState = {
        sessionId: current.sessionId,
        clientKey: next,
        origin: current.origin,
      }
      persistState(nextState)
      return { clientKey: next }
    })
    return next
  },
  ensureSession: async (tagId?: string) => {
    const existingId = get().sessionId
    const existingOrigin = get().origin ?? "customer"

    if (existingId) {
      const resumeRes = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: existingId,
          origin:
            existingOrigin === "staff"
              ? "STAFF"
              : "CUSTOMER",
          tagId,
        }),
      })

      if (resumeRes.ok) {
        return existingId
      }
    }

    const createRes = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        origin: "CUSTOMER",
        tagId,
      }),
    })

    if (!createRes.ok) {
      return null
    }

    const session = await createRes.json()
    get().setSession(session.id, "customer")
    return session.id
  },
}))
