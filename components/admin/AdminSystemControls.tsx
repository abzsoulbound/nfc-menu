"use client"

import Link from "next/link"
import { useState } from "react"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { FormInput } from "@/components/ui/FormField"
import { Modal } from "@/components/ui/Modal"
import { fetchJson } from "@/lib/fetchJson"

export function AdminSystemControls() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [setupBusy, setSetupBusy] = useState(false)
  const [stripeBusy, setStripeBusy] = useState(false)
  const [billingBusy, setBillingBusy] = useState(false)
  const [setupExpiresHours, setSetupExpiresHours] = useState("72")
  const [setupPreferredSlug, setSetupPreferredSlug] = useState("")
  const [setupLocation, setSetupLocation] = useState("")
  const [setupLink, setSetupLink] = useState<string | null>(null)
  const [setupExpiresAt, setSetupExpiresAt] = useState<string | null>(null)

  async function resetRuntime() {
    setBusy(true)
    setError(null)
    setNotice(null)
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

  async function createSetupLink() {
    setSetupBusy(true)
    setError(null)
    setNotice(null)
    setSetupLink(null)
    setSetupExpiresAt(null)
    try {
      const payload = await fetchJson<{
        setupLink: string
        expiresAt: string
      }>("/api/setup/link/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expiresInHours: Number(setupExpiresHours || "72"),
          bootstrap: {
            preferredSlug: setupPreferredSlug.trim() || null,
            location: setupLocation.trim() || null,
          },
        }),
      })
      setSetupLink(payload.setupLink)
      setSetupExpiresAt(payload.expiresAt)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSetupBusy(false)
    }
  }

  async function copySetupLink() {
    if (!setupLink) return
    try {
      await navigator.clipboard.writeText(setupLink)
    } catch {
      // Clipboard permission can fail in some environments; keep silent.
    }
  }

  async function startStripeConnect() {
    setStripeBusy(true)
    setError(null)
    setNotice(null)
    try {
      const payload = await fetchJson<{
        connectUrl: string
      }>("/api/stripe/connect/create-link", {
        method: "POST",
      })
      window.location.assign(payload.connectUrl)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setStripeBusy(false)
    }
  }

  async function startBillingSubscription() {
    setBillingBusy(true)
    setError(null)
    setNotice(null)
    try {
      const payload = await fetchJson<{
        checkoutUrl?: string
        active?: boolean
        subscriptionStatus?: string
      }>("/api/stripe/billing/subscribe", {
        method: "POST",
      })
      if (!payload.checkoutUrl) {
        if (payload.active) {
          setNotice(
            `Subscription is already ${String(
              payload.subscriptionStatus ?? "ACTIVE"
            ).toLowerCase()}.`
          )
          return
        }
        throw new Error("Stripe did not return a subscription checkout link")
      }
      window.location.assign(payload.checkoutUrl)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBillingBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            Self-Serve Setup Links
          </h2>
          <p className="text-sm text-secondary">
            Generate one onboarding link for a new restaurant owner. They complete setup without your manual help.
          </p>
        </div>

        {error && (
          <div className="status-chip status-chip-danger inline-flex">
            {error}
          </div>
        )}

        {notice && (
          <div className="status-chip status-chip-neutral inline-flex">
            {notice}
          </div>
        )}

        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          <FormInput
            label="Expires (hours)"
            value={setupExpiresHours}
            onChange={event => setSetupExpiresHours(event.target.value)}
            placeholder="72"
          />
          <FormInput
            label="Preferred slug"
            value={setupPreferredSlug}
            onChange={event => setSetupPreferredSlug(event.target.value)}
            placeholder="acme-bistro"
          />
          <FormInput
            label="Location"
            value={setupLocation}
            onChange={event => setSetupLocation(event.target.value)}
            placeholder="Leicester"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            disabled={setupBusy}
            onClick={() => createSetupLink().catch(() => {})}
          >
            {setupBusy ? "Creating..." : "Create setup link"}
          </Button>
          <Button
            variant="quiet"
            disabled={!setupLink}
            onClick={() => copySetupLink().catch(() => {})}
          >
            Copy link
          </Button>
          <Button
            variant="quiet"
            disabled={stripeBusy}
            onClick={() => startStripeConnect().catch(() => {})}
          >
            {stripeBusy ? "Opening Stripe..." : "Connect restaurant Stripe"}
          </Button>
          <Button
            variant="quiet"
            disabled={billingBusy}
            onClick={() => startBillingSubscription().catch(() => {})}
          >
            {billingBusy ? "Opening billing..." : "Start platform subscription"}
          </Button>
        </div>

        {setupLink && (
          <div className="space-y-2 rounded-[var(--radius-control)] border border-[var(--border)] surface-accent p-3 text-sm">
            <div className="font-semibold">Setup link</div>
            <div className="break-all mono-font text-xs">{setupLink}</div>
            <div className="text-xs text-secondary">
              Expires: {setupExpiresAt ? new Date(setupExpiresAt).toLocaleString() : "n/a"}
            </div>
          </div>
        )}
      </Card>

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

        {notice && (
          <div className="status-chip status-chip-neutral inline-flex">
            {notice}
          </div>
        )}

        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <Link
            href="/manager"
            className="focus-ring action-surface action-button min-h-[52px]"
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
    </div>
  )
}
