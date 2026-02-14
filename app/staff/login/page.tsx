"use client"

import { useEffect, useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Card } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Divider } from "@/components/ui/Divider"
import type { StaffRole } from "@/lib/staffAuth"

const ROLE_LABELS: Record<StaffRole, string> = {
  admin: "Admin",
  waiter: "Waiter",
  bar: "Bar",
  kitchen: "Kitchen",
}

function roleFromNextPath(nextPath: string | null): StaffRole | null {
  if (!nextPath || !nextPath.startsWith("/")) return null
  const normalized = nextPath.toLowerCase()

  if (/^\/(?:r\/[^/]+\/)?bar(\/|$)/.test(normalized)) {
    return "bar"
  }
  if (/^\/(?:r\/[^/]+\/)?kitchen(\/|$)/.test(normalized)) {
    return "kitchen"
  }
  if (
    /^\/(?:r\/[^/]+\/)?admin(\/|$)/.test(normalized) ||
    /^\/r\/[^/]+\/dashboard(\/|$)/.test(normalized)
  ) {
    return "admin"
  }

  return null
}

export default function StaffLoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname() ?? "/staff/login"
  const nextPath = searchParams.get("next")
  const tenantSlugMatch = pathname.match(/^\/r\/([^/]+)/)
  const tenantPrefix = tenantSlugMatch?.[1]
    ? `/r/${encodeURIComponent(tenantSlugMatch[1])}`
    : ""
  const forcedRole = useMemo(
    () => roleFromNextPath(nextPath),
    [nextPath]
  )

  const roleRoutes: Record<StaffRole, string> = {
    admin: tenantPrefix ? `${tenantPrefix}/dashboard` : "/admin",
    waiter: tenantPrefix ? `${tenantPrefix}/staff` : "/staff",
    bar: tenantPrefix ? `${tenantPrefix}/bar` : "/bar",
    kitchen: tenantPrefix ? `${tenantPrefix}/kitchen` : "/kitchen",
  }

  const [role, setRole] = useState<StaffRole>(forcedRole ?? "admin")
  const [passcode, setPasscode] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (forcedRole) {
      setRole(forcedRole)
    }
  }, [forcedRole])

  async function login() {
    if (submitting || !passcode.trim()) return
    setSubmitting(true)
    setError(null)

    const activeRole = forcedRole ?? role

    try {
      const res = await fetch("/api/staff/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: activeRole, passcode }),
      })

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}))
        if (res.status === 429) {
          const retryAfterMs = Number(payload?.retryAfterMs ?? 0)
          const retrySeconds =
            Number.isFinite(retryAfterMs) && retryAfterMs > 0
              ? Math.ceil(retryAfterMs / 1000)
              : null
          setError(
            retrySeconds
              ? `Too many attempts. Try again in ${retrySeconds}s.`
              : "Too many attempts. Try again shortly."
          )
          return
        }
        setError("Invalid passcode")
        return
      }

      if (nextPath && nextPath.startsWith("/")) {
        router.replace(nextPath)
        return
      }

      router.replace(roleRoutes[activeRole])
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-4 max-w-md mx-auto space-y-4">
      <Card>
        <div className="text-lg font-semibold">Staff Login</div>
        <div className="text-sm opacity-70">
          {forcedRole
            ? `Sign in to ${ROLE_LABELS[forcedRole]} with your passcode.`
            : "Sign in with your role passcode."}
        </div>
      </Card>

      <Card>
        <div className="space-y-3">
          {forcedRole ? (
            <div>
              <label className="text-sm opacity-70" htmlFor="role-locked">
                Role
              </label>
              <input
                id="role-locked"
                value={ROLE_LABELS[forcedRole]}
                className="input"
                readOnly
                aria-readonly="true"
              />
            </div>
          ) : (
            <div>
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
            </div>
          )}

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

          <Button
            onClick={login}
            disabled={submitting || !passcode.trim()}
            className="w-full"
          >
            {submitting ? "Signing in..." : "Sign in"}
          </Button>
        </div>
      </Card>

      <Divider />

      <Button
        variant="secondary"
        className="w-full"
        onClick={() =>
          router.push(
            tenantPrefix
              ? `/order${tenantPrefix}/menu`
              : "/order/menu"
          )
        }
      >
        Back to menu
      </Button>
    </div>
  )
}
