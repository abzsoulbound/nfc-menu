"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Divider } from "@/components/ui/Divider"

export default function StaffLoginPage() {
  const router = useRouter()
  const [secret, setSecret] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function login() {
    if (!secret || submitting) return
    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch("/api/staff/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret }),
      })

      if (!res.ok) {
        setError("Invalid staff secret")
        return
      }

      router.replace("/staff")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-4 max-w-md mx-auto space-y-4">
      <Card>
        <div className="text-lg font-semibold">Staff Login</div>
        <div className="text-sm opacity-70">
          Enter staff secret to access staff, kitchen, and bar.
        </div>
      </Card>

      <Card>
        <div className="space-y-3">
          <label className="text-sm opacity-70" htmlFor="staff-secret">
            Staff secret
          </label>
          <input
            id="staff-secret"
            type="password"
            value={secret}
            onChange={e => setSecret(e.target.value)}
            className="w-full rounded border px-3 py-2 bg-transparent"
            autoFocus
          />

          {error && <div className="text-sm text-red-400">{error}</div>}

          <Button onClick={login} disabled={submitting || !secret} className="w-full">
            {submitting ? "Signing in..." : "Sign in"}
          </Button>
        </div>
      </Card>

      <Divider />

      <Button
        variant="secondary"
        className="w-full"
        onClick={() => router.push("/menu")}
      >
        Back to menu
      </Button>
    </div>
  )
}
