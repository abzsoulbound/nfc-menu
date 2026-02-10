"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"
import { Divider } from "@/components/ui/Divider"
import { StaffOrderEditor } from "@/components/staff/StaffOrderEditor"

type Session = {
  id: string
  origin: "CUSTOMER" | "STAFF"
  tagId: string | null
  tableId: string | null
  lastActivityAt: string
  stale: boolean
}

export default function StaffSessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [activeSession, setActiveSession] = useState<Session | null>(null)

  async function fetchSessions() {
    const res = await fetch("/api/sessions", {
      cache: "no-store",
    })
    const data = await res.json()
    setSessions(data)
  }

  useEffect(() => {
    fetchSessions()
    const interval = setInterval(fetchSessions, 5000)
    return () => clearInterval(interval)
  }, [])

  async function createStaffSession() {
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        origin: "STAFF",
      }),
    })

    const session = await res.json()
    setActiveSession(session)
    fetchSessions()
  }

  function minutesSince(ts: string) {
    return Math.floor(
      (Date.now() - new Date(ts).getTime()) / 60000
    )
  }

  if (activeSession) {
    return (
      <StaffOrderEditor
        sessionId={activeSession.id}
        onBack={() => {
          setActiveSession(null)
          fetchSessions()
        }}
      />
    )
  }

  return (
    <div className="p-4 space-y-4">
      <Card
        className="cursor-pointer text-center"
        onClick={createStaffSession}
      >
        + Create staff session
      </Card>

      <Divider />

      {sessions.map(session => (
        <Card
          key={session.id}
          onClick={() => setActiveSession(session)}
          className="cursor-pointer"
        >
          <div className="flex justify-between items-center">
            <div className="space-y-1">
              <div className="text-sm font-mono">
                {session.id}
              </div>

              <div className="text-sm opacity-70">
                {session.origin === "STAFF"
                  ? "Staff-created session"
                  : "Customer session"}
              </div>

              <div className="text-xs opacity-60">
                Tag: {session.tagId ?? "—"} · Table:{" "}
                {session.tableId ?? "—"}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {session.stale && <Badge>stale</Badge>}
              <Badge>
                {minutesSince(session.lastActivityAt)}m
              </Badge>
            </div>
          </div>
        </Card>
      ))}

      {sessions.length === 0 && (
        <div className="opacity-60 text-center">
          No active sessions
        </div>
      )}
    </div>
  )
}
