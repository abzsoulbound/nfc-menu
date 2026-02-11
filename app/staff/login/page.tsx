"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Divider } from "@/components/ui/Divider"
import type { StaffRole } from "@/lib/staffAuth"

const roleRoutes: Record<StaffRole, string> = {
  admin: "/admin",
  waiter: "/staff",
  bar: "/bar",
  kitchen: "/kitchen",
}

export default function StaffLoginPage() {
  const router = useRouter()
  const [role, setRole] = useState<StaffRole>("admin")
  const [passcode, setPasscode] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function login() {
    if (!passcode || submitting) return
    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch("/api/staff/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, passcode }),
      })

      if (!res.ok) {
        setError("Invalid passcode")
        return
      }

      router.replace(roleRoutes[role])
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-4 max-w-md mx-auto space-y-4">
      <Card>
        <div className="text-lg font-semibold">Staff Login</div>
        <div className="text-sm opacity-70">
          Role-specific passcodes are now used for staff access.
        </div>
      </Card>

      <Card>
        <div className="space-y-3">
          <label className="text-sm opacity-70" htmlFor="role">
            Role
          </label>
          <select
            id="role"
            value={role}
            onChange={e => setRole(e.target.value as StaffRole)}
            className="input"
          >
            <option value="admin">Admin</option>
            <option value="waiter">Waiter</option>
            <option value="bar">Bar</option>
            <option value="kitchen">Kitchen</option>
          </select>

          <label className="text-sm opacity-70" htmlFor="staff-passcode">
            Passcode
          </label>
          <input
            id="staff-passcode"
            type="password"
            value={passcode}
            onChange={e => setPasscode(e.target.value)}
            className="input"
            autoFocus
          />

          {error && <div className="text-sm text-red-400">{error}</div>}

          <Button onClick={login} disabled={submitting || !passcode} className="w-full">
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
