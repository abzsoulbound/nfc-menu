"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { Divider } from "@/components/ui/Divider"
import { fetchJson } from "@/lib/fetchJson"

type LoginResponse = {
  ok: true
  role: "WAITER" | "BAR" | "KITCHEN" | "MANAGER" | "ADMIN"
  redirectTo: string
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"]
const STAFF_ROUTE_ACCESS: Record<
  LoginResponse["role"],
  LoginResponse["role"][]
> = {
  WAITER: ["WAITER"],
  BAR: ["BAR"],
  KITCHEN: ["KITCHEN"],
  MANAGER: ["WAITER", "BAR", "KITCHEN", "MANAGER"],
  ADMIN: ["WAITER", "BAR", "KITCHEN", "MANAGER", "ADMIN"],
}

function canRoleAccessPath(
  role: LoginResponse["role"],
  path: string
) {
  if (path.startsWith("/admin")) {
    return role === "ADMIN"
  }
  if (path.startsWith("/manager")) {
    return STAFF_ROUTE_ACCESS[role].includes("MANAGER")
  }
  if (path.startsWith("/kitchen")) {
    return STAFF_ROUTE_ACCESS[role].includes("KITCHEN")
  }
  if (path.startsWith("/bar")) {
    return STAFF_ROUTE_ACCESS[role].includes("BAR")
  }
  if (path.startsWith("/staff")) {
    return STAFF_ROUTE_ACCESS[role].includes("WAITER")
  }
  return true
}

function normalizeLegacyNextPath(path: string | null) {
  if (!path) return null
  if (!path.startsWith("/")) return null
  if (path.startsWith("//")) return null
  if (path === "/waiter") return "/staff"
  if (path.startsWith("/waiter/")) {
    return `/staff/${path.slice("/waiter/".length)}`
  }
  return path
}

export default function StaffLoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [passcode, setPasscode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function appendDigit(digit: string) {
    if (loading || passcode.length >= 4) return
    setPasscode(prev => `${prev}${digit}`.slice(0, 4))
  }

  function backspace() {
    if (loading) return
    setPasscode(prev => prev.slice(0, -1))
  }

  async function submit() {
    if (passcode.length !== 4) return
    setLoading(true)
    setError(null)

    try {
      const result = await fetchJson<LoginResponse>(
        "/api/auth/staff",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ passcode }),
        }
      )
      const nextPath = normalizeLegacyNextPath(
        searchParams.get("next")
      )
      if (nextPath && canRoleAccessPath(result.role, nextPath)) {
        router.push(nextPath)
      } else {
        router.push(result.redirectTo)
      }
    } catch (err) {
      setError((err as Error).message)
      setPasscode("")
    } finally {
      setLoading(false)
    }
  }

  async function logout() {
    await fetchJson("/api/auth/staff", {
      method: "DELETE",
    })
    setPasscode("")
    setError(null)
  }

  return (
    <div className="min-h-[calc(100vh-124px)] px-4 py-6 md:px-6 md:py-10">
      <div className="mx-auto max-w-md">
        <Card variant="elevated" className="space-y-4">
          <div>
            <h1 className="display-font text-4xl tracking-tight">
              Staff Access
            </h1>
            <p className="text-sm text-secondary">
              Enter your 4-digit passcode to access your role screen.
            </p>
          </div>

          <Divider />

          <div className="rounded-2xl border border-[var(--border)] surface-accent p-3 text-center">
            <div className="mono-font text-3xl tracking-[0.45em]">
              {passcode.padEnd(4, "*")}
            </div>
            <div className="mt-1 text-xs text-secondary">
              Use your role/device 4-digit code.
            </div>
          </div>

          {error && (
            <div className="status-chip status-chip-danger text-center">
              {error}
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            {KEYS.map(key => (
              <button
                key={key}
                type="button"
                onClick={() => appendDigit(key)}
                className="focus-ring min-h-[52px] rounded-xl border border-[var(--border)] surface-secondary text-lg font-semibold transition-all hover:-translate-y-px"
              >
                {key}
              </button>
            ))}

            <button
              type="button"
              onClick={backspace}
              className="focus-ring min-h-[52px] rounded-xl border border-[var(--border)] surface-secondary text-base font-semibold"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => appendDigit("0")}
              className="focus-ring min-h-[52px] rounded-xl border border-[var(--border)] surface-secondary text-lg font-semibold"
            >
              0
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={passcode.length !== 4 || loading}
              className="focus-ring min-h-[52px] rounded-xl border border-transparent bg-[var(--accent-action)] text-base font-semibold text-white disabled:opacity-50"
            >
              {loading ? "..." : "Go"}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="quiet"
              className="w-full"
              onClick={() => setPasscode("")}
              disabled={loading}
            >
              Clear
            </Button>
            <Button
              className="w-full"
              variant="ghost"
              onClick={() => logout().catch(() => {})}
            >
              Sign out
            </Button>
          </div>
        </Card>
      </div>
    </div>
  )
}
