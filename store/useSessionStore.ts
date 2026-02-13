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

export const useSessionStore = create<SessionState>((set, get) => ({
  sessionId: null,
  clientKey: null,
  origin: null,
  setSession: (id, origin) =>
    set(() => ({ sessionId: id, origin })),
  clearSession: () =>
    set(() => ({ sessionId: null, clientKey: null, origin: null })),
  hydrate: () => {
    // Local persistence is intentionally disabled for full online mode.
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

    set({ clientKey: next })
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
