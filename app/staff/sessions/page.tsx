"use client"

import { useCallback, useEffect, useState } from "react"
import { StaffOrderEditor } from "@/components/staff/StaffOrderEditor"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
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

  return (
    <div className="px-4 py-5 md:px-6 md:py-6">
      <div className="mx-auto grid max-w-[1440px] gap-4 lg:grid-cols-[1fr_1.35fr]">
        <Card className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold tracking-tight">
              Sessions
            </h2>
            <Button
              variant="primary"
              className="min-h-[44px]"
              onClick={() => createStaffSession().catch(() => {})}
            >
              + Create
            </Button>
          </div>

          <div className="space-y-2">
            {sessions.map(session => (
              <button
                key={session.id}
                type="button"
                onClick={() => setActiveSession(session)}
                className={`focus-ring w-full rounded-[var(--radius-control)] border border-[var(--border)] p-3 text-left ${
                  activeSession?.id === session.id
                    ? "surface-accent"
                    : "surface-secondary"
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

            {sessions.length === 0 && (
              <div className="py-8 text-center text-sm text-secondary">
                No active sessions.
              </div>
            )}
          </div>
        </Card>

        <Card className="p-0">
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
  )
}
