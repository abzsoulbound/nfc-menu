"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { fetchJson } from "@/lib/fetchJson"

type SetupResult = {
  restaurant: {
    slug: string
    name: string
  }
  launchUrl: string
  staffLoginUrl: string
  checklist: {
    score: number
    items: { id: string; label: string; done: boolean }[]
  }
  nextActions: {
    label: string
    href: string
    role: string
  }[]
  passcodes: Record<
    "WAITER" | "BAR" | "KITCHEN" | "MANAGER" | "ADMIN",
    string[]
  >
}

type SetupStatus = {
  valid: boolean
  state: "READY" | "EXPIRED" | "CONSUMED" | "INVALID"
  expiresAt: string | null
  consumedAt: string | null
  bootstrap: {
    preferredSlug?: string | null
    location?: string | null
    logoUrl?: string | null
    heroUrl?: string | null
    menuCsv?: string | null
    tableCount?: number
    notes?: string | null
  } | null
  restaurant: {
    slug: string
    name: string
  } | null
}

export default function SetupPage({
  params,
}: {
  params: { token: string }
}) {
  const token = useMemo(() => params.token ?? "", [params.token])
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [location, setLocation] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [loadingStatus, setLoadingStatus] = useState(true)
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(
    null
  )
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<SetupResult | null>(null)

  useEffect(() => {
    let mounted = true
    setLoadingStatus(true)
    fetchJson<SetupStatus>(`/api/setup/status/${token}`, {
      cache: "no-store",
    })
      .then(status => {
        if (!mounted) return
        setSetupStatus(status)
        if (status.bootstrap?.preferredSlug) {
          setSlug(status.bootstrap.preferredSlug)
        }
        if (status.bootstrap?.location) {
          setLocation(status.bootstrap.location)
        }
      })
      .catch(err => {
        if (!mounted) return
        setError((err as Error).message)
      })
      .finally(() => {
        if (!mounted) return
        setLoadingStatus(false)
      })

    return () => {
      mounted = false
    }
  }, [token])

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!setupStatus || setupStatus.state !== "READY") {
      setError("Setup link is not ready for provisioning.")
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const payload = await fetchJson<SetupResult>(
        "/api/setup/complete",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            token,
            name,
            slug: slug.trim() || null,
            location: location.trim() || null,
          }),
        }
      )
      setResult(payload)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  if (result) {
    return (
      <div className="px-4 py-8 md:px-8 md:py-10">
        <div className="mx-auto max-w-[760px] space-y-4">
          <div className="rounded-2xl border border-[var(--border)] surface-secondary p-5">
            <h1 className="display-font text-3xl tracking-tight">
              Setup Complete
            </h1>
            <p className="mt-2 text-sm text-secondary">
              {result.restaurant.name} is ready.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href={result.launchUrl}
                className="focus-ring inline-flex min-h-[40px] items-center rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--accent-action)] px-3 text-sm font-semibold text-white"
              >
                Open Customer Menu
              </Link>
              <Link
                href={result.staffLoginUrl}
                className="focus-ring inline-flex min-h-[40px] items-center rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--accent-quiet)] px-3 text-sm font-semibold"
              >
                Open Staff Login
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border)] surface-accent p-5">
            <h2 className="text-base font-semibold">Initial Passcodes</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {Object.entries(result.passcodes).map(([role, codes]) => (
                <div
                  key={role}
                  className="rounded-xl border border-[var(--border)] bg-white/50 px-3 py-2"
                >
                  <div className="text-[11px] uppercase tracking-[0.15em] text-muted">
                    {role}
                  </div>
                  <div className="mono-font mt-1 text-sm font-semibold">
                    {codes.join(", ")}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border)] surface-secondary p-5">
            <h2 className="text-base font-semibold">
              Onboarding Checklist ({result.checklist.score}%)
            </h2>
            <div className="mt-3 space-y-2 text-sm">
              {result.checklist.items.map(item => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-[var(--radius-control)] border border-[var(--border)] bg-white/60 px-3 py-2"
                >
                  <span>{item.label}</span>
                  <span className="mono-font text-xs">
                    {item.done ? "DONE" : "PENDING"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border)] surface-accent p-5">
            <h2 className="text-base font-semibold">Next Actions</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {result.nextActions.map(action => (
                <Link
                  key={`${action.role}:${action.href}`}
                  href={action.href}
                  className="focus-ring inline-flex min-h-[38px] items-center rounded-[var(--radius-control)] border border-[var(--border)] bg-white/70 px-3 text-sm font-medium"
                >
                  {action.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 py-8 md:px-8 md:py-10">
      <div className="mx-auto max-w-[760px] space-y-4">
        <div className="rounded-2xl border border-[var(--border)] surface-secondary p-5">
          <h1 className="display-font text-3xl tracking-tight">
            Restaurant Setup
          </h1>
          <p className="mt-2 text-sm text-secondary">
            Complete this once to provision your restaurant workspace.
          </p>
          {loadingStatus ? (
            <p className="mt-3 text-xs text-muted">Checking setup link...</p>
          ) : setupStatus ? (
            <p className="mt-3 text-xs text-muted">
              Link status: <span className="mono-font">{setupStatus.state}</span>
              {setupStatus.expiresAt
                ? ` | Expires ${new Date(setupStatus.expiresAt).toLocaleString()}`
                : ""}
            </p>
          ) : null}
        </div>

        <form
          onSubmit={onSubmit}
          className="space-y-3 rounded-2xl border border-[var(--border)] surface-accent p-5"
        >
          <label className="block text-sm font-medium">
            Restaurant Name
            <input
              required
              className="mt-1 w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
              value={name}
              onChange={event => setName(event.target.value)}
              placeholder="Acme Bistro"
            />
          </label>
          <label className="block text-sm font-medium">
            URL Slug (optional)
            <input
              className="mt-1 w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
              value={slug}
              onChange={event => setSlug(event.target.value)}
              placeholder="acme-bistro"
            />
          </label>
          <label className="block text-sm font-medium">
            Location (optional)
            <input
              className="mt-1 w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
              value={location}
              onChange={event => setLocation(event.target.value)}
              placeholder="Leicester"
            />
          </label>

          {error ? (
            <p className="text-sm text-[var(--status-danger)]">{error}</p>
          ) : null}

          <button
            type="submit"
            disabled={
              submitting ||
              loadingStatus ||
              setupStatus?.state !== "READY"
            }
            className="focus-ring inline-flex min-h-[40px] items-center rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--accent-action)] px-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Provisioning..." : "Complete Setup"}
          </button>
        </form>
      </div>
    </div>
  )
}
