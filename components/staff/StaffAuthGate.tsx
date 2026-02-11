"use client"

import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react"
import { usePathname } from "next/navigation"
import { Card } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import type { StaffRole } from "@/lib/staffAuth"

type AuthStatus = {
  authorized: boolean
  locked: boolean
  failures: number
  remaining: number
}

const ROLE_LABELS: Record<StaffRole, string> = {
  admin: "Admin",
  waiter: "Waiter",
  bar: "Bar",
  kitchen: "Kitchen",
}

function roleFromPath(pathname: string): StaffRole | null {
  if (pathname.startsWith("/staff/login")) return null
  if (pathname.startsWith("/staff")) return "waiter"
  if (pathname.startsWith("/admin")) return "admin"
  if (pathname.startsWith("/waiter")) return "waiter"
  if (pathname.startsWith("/bar")) return "bar"
  if (pathname.startsWith("/kitchen")) return "kitchen"
  return null
}

export function StaffAuthGate({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const role = useMemo(() => roleFromPath(pathname), [pathname])
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)
  const [locked, setLocked] = useState(false)
  const [remaining, setRemaining] = useState(3)
  const [passcode, setPasscode] = useState("")
  const [managerPasscode, setManagerPasscode] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function fetchStatus(targetRole: StaffRole) {
    const res = await fetch(`/api/staff/auth?role=${targetRole}`, {
      cache: "no-store",
    })
    if (!res.ok) {
      setAuthorized(false)
      setLocked(false)
      setRemaining(3)
      return
    }
    const data = (await res.json()) as AuthStatus
    setAuthorized(data.authorized)
    setLocked(data.locked)
    setRemaining(data.remaining)
  }

  useEffect(() => {
    if (!role) {
      setLoading(false)
      return
    }

    setLoading(true)
    fetchStatus(role)
      .catch(() => {
        setAuthorized(false)
        setLocked(false)
        setRemaining(3)
      })
      .finally(() => setLoading(false))
  }, [role])

  async function submitRolePasscode(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!role || !passcode || submitting) return
    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch("/api/staff/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, passcode }),
      })
      const data = await res.json()
      if (res.ok) {
        setAuthorized(true)
        setPasscode("")
        return
      }

      if (res.status === 423 || data.locked) {
        setLocked(true)
      }
      if (typeof data.remaining === "number") {
        setRemaining(data.remaining)
      }
      setError("Incorrect passcode.")
    } finally {
      setSubmitting(false)
    }
  }

  async function unlockWithManager(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!managerPasscode || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch("/api/staff/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "unlock",
          managerPasscode,
        }),
      })

      if (!res.ok) {
        setError("Invalid manager passcode.")
        return
      }

      setLocked(false)
      setRemaining(3)
      setManagerPasscode("")
      setPasscode("")
    } finally {
      setSubmitting(false)
    }
  }

  if (!role) return <>{children}</>
  if (loading) return null
  if (authorized) return <>{children}</>

  return (
    <>
      <div className="modal-overlay">
        <Card className="w-full max-w-md space-y-4">
          <div className="space-y-1">
            <div className="text-lg font-semibold">{ROLE_LABELS[role]} Login</div>
            <div className="text-sm opacity-70">
              {locked
                ? "Locked after 3 incorrect passcodes. Manager unlock is required."
                : `Enter the ${ROLE_LABELS[role].toLowerCase()} passcode.`}
            </div>
            {!locked && (
              <div className="text-xs opacity-60">{remaining} attempt(s) remaining</div>
            )}
          </div>

          {!locked ? (
            <form className="space-y-3" onSubmit={submitRolePasscode}>
              <input
                type="password"
                value={passcode}
                onChange={e => setPasscode(e.target.value)}
                className="input"
                autoFocus
              />
              {error && <div className="text-sm text-red-400">{error}</div>}
              <Button disabled={submitting || !passcode} className="w-full">
                {submitting ? "Checking..." : "Unlock"}
              </Button>
            </form>
          ) : (
            <form className="space-y-3" onSubmit={unlockWithManager}>
              <input
                type="password"
                value={managerPasscode}
                onChange={e => setManagerPasscode(e.target.value)}
                className="input"
                placeholder="Manager passcode"
                autoFocus
              />
              {error && <div className="text-sm text-red-400">{error}</div>}
              <Button disabled={submitting || !managerPasscode} className="w-full">
                {submitting ? "Unlocking..." : "Manager Unlock"}
              </Button>
            </form>
          )}
        </Card>
      </div>
    </>
  )
}
