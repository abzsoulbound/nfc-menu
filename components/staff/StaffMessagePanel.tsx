"use client"

import { useState } from "react"
import { Card } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"

export function StaffMessagePanel({
  tableId,
}: {
  tableId: string
}) {
  const [message, setMessage] = useState("")
  const [target, setTarget] = useState<"KITCHEN" | "BAR">("KITCHEN")

  async function send() {
    if (!message.trim()) return

    await fetch("/api/staff", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tableId,
        target,
        message,
      }),
    })

    setMessage("")
  }

  return (
    <Card>
      <div className="space-y-2">
        <select
          value={target}
          onChange={e =>
            setTarget(e.target.value as any)
          }
        >
          <option value="KITCHEN">Kitchen</option>
          <option value="BAR">Bar</option>
        </select>

        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="Message for station"
        />

        <Button onClick={send}>
          Send
        </Button>
      </div>
    </Card>
  )
}