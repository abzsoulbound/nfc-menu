"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { StaffOrderEditor } from "@/components/staff/StaffOrderEditor"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { FormInput } from "@/components/ui/FormField"
import { fetchJson } from "@/lib/fetchJson"
import { useRealtimeSync } from "@/lib/useRealtimeSync"
import { SessionDTO } from "@/lib/types"

function minutesSince(ts: string) {
  return Math.floor(
    (Date.now() - new Date(ts).getTime()) / 60000
  )
}

export default function StaffSessionsPage() {
  const [sessions, setSessions] = useState<SessionDTO[]>([])
  const [activeSession, setActiveSession] =
    useState<SessionDTO | null>(null)
  const [search, setSearch] = useState("")

  const fetchSessions = useCallback(async () => {
    const data = await fetchJson<SessionDTO[]>("/api/sessions", {
      cache: "no-store",
    })
    setSessions(data)
  }, [])

  useEffect(() => {
    fetchSessions().catch(() => setSessions([]))
    const interval = setInterval(() => {
      fetchSessions().catch(() => setSessions([]))
    }, 5000)
    return () => clearInterval(interval)
  }, [fetchSessions])

  useRealtimeSync(() => {
    fetchSessions().catch(() => setSessions([]))
  })

  async function createStaffSession() {
    const session = await fetchJson<SessionDTO>("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        origin: "STAFF",
      }),
    })

    setActiveSession(session)
    await fetchSessions()
  }

  const filteredSessions = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return sessions

    return sessions.filter(session => {
      const haystack = [
        session.id,
        session.origin,
        session.tagId ?? "",
        session.tableId ?? "",
      ]
        .join(" ")
        .toLowerCase()
      return haystack.includes(query)
    })
  }, [search, sessions])

  const staffSessions = sessions.filter(
    session => session.origin === "STAFF"
  )
  const staleSessions = sessions.filter(session => session.stale)

  return (
    <div className="relative px-4 py-5 md:px-6 md:py-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-12 top-16 h-44 w-44 rounded-full bg-[image:var(--orb-navy)] blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 top-52 h-48 w-48 rounded-full bg-[image:var(--orb-navy)] blur-3xl"
      />

      <div className="mx-auto space-y-4">
        <Card
          variant="elevated"
          className="border-[var(--section-border)] bg-[image:var(--section-gradient)]"
        >
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div className="space-y-2">
              <div className="text-[10px] uppercase tracking-[0.18em] text-[rgba(255,255,255,0.82)]">
                Session Operations
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
                Control active service sessions
              </h1>
              <p className="max-w-3xl text-sm leading-6 text-[rgba(255,255,255,0.86)]">
                Manage staff and customer sessions in one place before opening
                the order editor.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="status-chip status-chip-neutral">
                  Total: {sessions.length}
                </span>
                <span className="status-chip status-chip-neutral">
                  Staff: {staffSessions.length}
                </span>
                <span className="status-chip status-chip-warning">
                  Stale: {staleSessions.length}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="primary"
                className="min-h-[44px]"
                onClick={() => createStaffSession().catch(() => {})}
              >
                + Create
              </Button>
              <Button
                variant="quiet"
                className="min-h-[44px]"
                onClick={() => fetchSessions().catch(() => setSessions([]))}
              >
                Refresh
              </Button>
            </div>
          </div>
        </Card>

        <div className="mx-auto grid max-w-[1440px] gap-4 lg:grid-cols-[1fr_1.35fr]">
          <Card className="space-y-3 border-[rgba(0,18,88,0.34)]">
            <div className="space-y-2">
              <h2 className="text-lg font-semibold tracking-tight">Sessions</h2>
              <FormInput
                label="Search session"
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="id, origin, tag, table"
              />
            </div>

            <div className="space-y-2">
              {filteredSessions.map(session => (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => setActiveSession(session)}
                  className={`focus-ring action-surface action-card action-card-left w-full ${
                    activeSession?.id === session.id
                      ? ""
                      : "action-surface-muted"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="mono-font text-sm font-semibold">
                        {session.id}
                      </div>
                      <div className="text-xs text-secondary">
                        {session.origin === "STAFF"
                          ? "Staff-created session"
                          : "Customer session"}
                      </div>
                      <div className="text-xs text-muted">
                        Tag: {session.tagId ?? "-"} | Table:{" "}
                        {session.tableId ?? "-"}
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {session.stale && (
                        <Badge variant="warning">Stale</Badge>
                      )}
                      <Badge variant="neutral">
                        {minutesSince(session.lastActivityAt)}m
                      </Badge>
                    </div>
                  </div>
                </button>
              ))}

              {filteredSessions.length === 0 && (
                <div className="py-8 text-center text-sm text-secondary">
                  No matching sessions.
                </div>
              )}
            </div>
          </Card>

          <Card className="border-[rgba(0,18,88,0.34)] p-0">
            {!activeSession ? (
              <div className="p-10 text-center text-sm text-secondary">
                Select a session to open the staff order editor.
              </div>
            ) : (
              <StaffOrderEditor
                sessionId={activeSession.id}
                onBack={() => setActiveSession(null)}
              />
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
