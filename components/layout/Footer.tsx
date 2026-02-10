"use client"

import { Card } from "@/components/ui/Card"
import { useSessionStore } from "@/store/useSessionStore"

export function Footer() {
  const sessionId = useSessionStore(s => s.sessionId)

  return (
    <footer className="surface-primary border-t">
      <Card>
        <div className="text-xs opacity-60 text-center">
          {sessionId ? `Session ${sessionId.slice(0, 8)}` : "No session"}
        </div>
      </Card>
    </footer>
  )
}