import { create } from "zustand"

const SESSION_KEY = "nfc-pos.session.v1"

type SessionState = {
  sessionId: string | null
  origin: "customer" | "staff" | null
  setSession: (id: string, origin: "customer" | "staff") => void
  clearSession: () => void
  hydrate: () => void
  ensureSession: (tagId?: string) => Promise<string | null>
}

function persistSession(
  sessionId: string | null,
  origin: "customer" | "staff" | null
) {
  if (typeof window === "undefined") return
  if (!sessionId || !origin) {
    window.localStorage.removeItem(SESSION_KEY)
    return
  }
  window.localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({ sessionId, origin })
  )
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessionId: null,
  origin: null,
  setSession: (id, origin) =>
    set(() => {
      persistSession(id, origin)
      return { sessionId: id, origin }
    }),
  clearSession: () =>
    set(() => {
      persistSession(null, null)
      return { sessionId: null, origin: null }
    }),
  hydrate: () => {
    if (typeof window === "undefined") return
    const raw = window.localStorage.getItem(SESSION_KEY)
    if (!raw) return
    try {
      const parsed = JSON.parse(raw) as {
        sessionId?: string
        origin?: "customer" | "staff"
      }
      if (parsed.sessionId && parsed.origin) {
        set({
          sessionId: parsed.sessionId,
          origin: parsed.origin,
        })
      }
    } catch {
      set({ sessionId: null, origin: null })
    }
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
