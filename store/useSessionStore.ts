import { create } from "zustand"
import { fetchJson } from "@/lib/fetchJson"
import { SessionDTO } from "@/lib/types"

const SESSION_KEY = "nfc-pos.session.v2"

type Origin = "customer" | "staff"

type SessionState = {
  sessionId: string | null
  origin: Origin | null
  setSession: (id: string, origin: Origin) => void
  clearSession: () => void
  hydrate: () => void
  ensureCustomerSession: (tagId: string) => Promise<string | null>
  ensureStaffSession: () => Promise<string | null>
}

function persistSession(
  sessionId: string | null,
  origin: Origin | null
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

function normalizeOrigin(origin: SessionDTO["origin"]): Origin {
  return origin === "STAFF" ? "staff" : "customer"
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
        origin?: Origin
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
  ensureCustomerSession: async tagId => {
    const existingId = get().sessionId
    const existingOrigin = get().origin

    if (existingId && existingOrigin === "customer") {
      try {
        const resumed = await fetchJson<SessionDTO>(
          "/api/sessions",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sessionId: existingId,
              origin: "CUSTOMER",
              tagId,
            }),
          }
        )
        get().setSession(
          resumed.id,
          normalizeOrigin(resumed.origin)
        )
        return resumed.id
      } catch {
        // fall through to create
      }
    }

    try {
      const created = await fetchJson<SessionDTO>(
        "/api/sessions",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            origin: "CUSTOMER",
            tagId,
          }),
        }
      )
      get().setSession(
        created.id,
        normalizeOrigin(created.origin)
      )
      return created.id
    } catch {
      return null
    }
  },
  ensureStaffSession: async () => {
    const existingId = get().sessionId
    const existingOrigin = get().origin

    if (existingId && existingOrigin === "staff") {
      try {
        const resumed = await fetchJson<SessionDTO>(
          "/api/sessions",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sessionId: existingId,
              origin: "STAFF",
            }),
          }
        )
        get().setSession(
          resumed.id,
          normalizeOrigin(resumed.origin)
        )
        return resumed.id
      } catch {
        // fall through to create
      }
    }

    try {
      const created = await fetchJson<SessionDTO>(
        "/api/sessions",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            origin: "STAFF",
          }),
        }
      )
      get().setSession(
        created.id,
        normalizeOrigin(created.origin)
      )
      return created.id
    } catch {
      return null
    }
  },
}))
