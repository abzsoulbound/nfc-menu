"use client"

import Link from "next/link"
import { useState } from "react"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { Modal } from "@/components/ui/Modal"
import { fetchJson } from "@/lib/fetchJson"

export function AdminSystemControls() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)

  async function resetRuntime() {
    setBusy(true)
    setError(null)
    try {
      await fetchJson("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "RESET_RUNTIME" }),
      })
      setShowConfirm(false)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="space-y-3">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">
          Developer Controls
        </h2>
        <p className="text-sm text-secondary">
          Admin panel is for technical control. Floor operations stay in manager console.
        </p>
      </div>

      {error && (
        <div className="status-chip status-chip-danger inline-flex">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <Link
          href="/manager"
          className="focus-ring inline-flex min-h-[52px] items-center justify-center rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--accent-quiet)] px-4 py-2 text-sm font-semibold"
        >
          Open manager console
        </Link>
        <Button
          variant="danger"
          className="min-h-[52px]"
          disabled={busy}
          onClick={() => setShowConfirm(true)}
        >
          Reset runtime state
        </Button>
      </div>

      {showConfirm && (
        <Modal
          title="Reset runtime state"
          onCancel={() => setShowConfirm(false)}
          onConfirm={() => resetRuntime().catch(() => {})}
          confirmLabel={busy ? "Resetting..." : "Reset now"}
          confirmDisabled={busy}
        >
          This clears active sessions, orders, tags, and table state. Use only for recovery/testing.
        </Modal>
      )}
    </Card>
  )
}

