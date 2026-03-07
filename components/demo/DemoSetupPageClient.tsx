"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/Button"
import { FormInput } from "@/components/ui/FormField"
import {
  cloneDemoSetupConfig,
  DEFAULT_DEMO_SETUP_CONFIG,
  DEMO_CUSTOMER_ROUTE_DEFINITIONS,
  DEMO_STAFF_ROUTE_DEFINITIONS,
  sanitizeDemoSetupConfig,
  type DemoCustomerRouteKey,
  type DemoStaffRouteKey,
  type DemoSetupConfig,
} from "@/lib/demoSetup"
import {
  persistDemoSetupConfig,
  readStoredDemoSetupConfig,
  resetDemoSetupConfig,
} from "@/lib/demoSetupClient"

const textareaClass =
  "input-premium min-h-[88px] w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-transparent px-3 py-2 text-sm text-[var(--text-primary)]"

function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  return (
    <label className="space-y-1">
      <span className="text-xs text-muted">{label}</span>
      <textarea
        className={textareaClass}
        value={value}
        placeholder={placeholder}
        onChange={event => onChange(event.target.value)}
      />
    </label>
  )
}

function RouteCopyEditor<TKey extends string>({
  title,
  routeKey,
  value,
  onChange,
}: {
  title: string
  routeKey: TKey
  value: {
    label: string
    desc: string
  }
  onChange: (
    key: TKey,
    patch: Partial<{
      label: string
      desc: string
    }>
  ) => void
}) {
  return (
    <div className="rounded-[16px] border border-[rgba(232,220,198,0.18)] bg-[rgba(6,12,24,0.55)] p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-semibold text-white">
          {title}
        </div>
        <div className="mono-font text-[11px] uppercase tracking-[0.14em] text-[rgba(255,255,255,0.5)]">
          {routeKey}
        </div>
      </div>
      <div className="mt-3 grid gap-3">
        <FormInput
          label="Label"
          value={value.label}
          onChange={event =>
            onChange(routeKey, { label: event.target.value })
          }
        />
        <TextAreaField
          label="Description"
          value={value.desc}
          onChange={desc => onChange(routeKey, { desc })}
        />
      </div>
    </div>
  )
}

export function DemoSetupPageClient() {
  const [draft, setDraft] = useState<DemoSetupConfig>(() =>
    cloneDemoSetupConfig(DEFAULT_DEMO_SETUP_CONFIG)
  )
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setDraft(readStoredDemoSetupConfig())
    setLoaded(true)
  }, [])

  function updateField<TKey extends keyof DemoSetupConfig>(
    key: TKey,
    value: DemoSetupConfig[TKey]
  ) {
    setDraft(prev => ({
      ...prev,
      [key]: value,
    }))
  }

  function updateCustomerRoute(
    key: DemoCustomerRouteKey,
    patch: Partial<{
      label: string
      desc: string
    }>
  ) {
    setDraft(prev => ({
      ...prev,
      customerRoutes: {
        ...prev.customerRoutes,
        [key]: {
          ...prev.customerRoutes[key],
          ...patch,
        },
      },
    }))
  }

  function updateStaffRoute(
    key: DemoStaffRouteKey,
    patch: Partial<{
      label: string
      desc: string
    }>
  ) {
    setDraft(prev => ({
      ...prev,
      staffRoutes: {
        ...prev.staffRoutes,
        [key]: {
          ...prev.staffRoutes[key],
          ...patch,
        },
      },
    }))
  }

  function saveDraft() {
    const saved = persistDemoSetupConfig(draft)
    setDraft(saved)
    setSavedAt(new Date().toLocaleTimeString())
  }

  function resetDraft() {
    const reset = resetDemoSetupConfig()
    setDraft(reset)
    setSavedAt(null)
  }

  const preview = sanitizeDemoSetupConfig(draft)

  return (
    <div className="relative overflow-hidden px-4 py-8 md:px-8 md:py-12">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_14%_8%,rgba(0,18,88,0.85),transparent_40%),radial-gradient(circle_at_88%_12%,rgba(229,170,20,0.12),transparent_48%),linear-gradient(180deg,rgba(0,8,36,1)_0%,rgba(0,14,58,1)_42%,rgba(0,18,88,1)_100%)]"
      />

      <div className="mx-auto max-w-[1380px] space-y-5">
        <div className="rounded-[24px] border border-[rgba(229,170,20,0.3)] bg-[linear-gradient(160deg,rgba(0,8,36,0.96),rgba(0,18,88,0.93))] p-6 text-white">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
            <div className="space-y-2">
              <div className="text-[10px] uppercase tracking-[0.18em] text-[rgba(229,170,20,0.72)]">
                Demo Setup
              </div>
              <h1 className="display-font text-3xl font-semibold tracking-tight md:text-4xl">
                Rotate the sales pitch without touching code
              </h1>
              <p className="max-w-3xl text-sm leading-6 text-[rgba(255,255,255,0.72)]">
                This page controls the pitch-facing copy shown on{" "}
                <span className="mono-font">/demo</span>. Changes are stored in
                this browser so you can reframe the walkthrough per company
                before each meeting.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/demo"
                className="focus-ring inline-flex min-h-[42px] items-center justify-center rounded-xl border border-[rgba(255,255,255,0.16)] bg-[rgba(255,255,255,0.08)] px-4 text-sm font-semibold text-white transition-colors hover:bg-[rgba(255,255,255,0.14)]"
              >
                Open demo
              </Link>
              <Button onClick={saveDraft}>Save setup</Button>
              <Button variant="quiet" onClick={resetDraft}>
                Reset defaults
              </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
          <div className="space-y-4">
            <div className="space-y-4 rounded-[24px] border border-[rgba(232,220,198,0.18)] bg-[rgba(6,12,24,0.55)] p-6 text-white">
              <div className="space-y-1">
                <div className="text-[10px] uppercase tracking-[0.16em] text-[rgba(229,170,20,0.72)]">
                  Buyer Frame
                </div>
                <h2 className="text-xl font-semibold tracking-tight">
                  Pitch context
                </h2>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <FormInput
                  label="Company name"
                  value={draft.companyName}
                  onChange={event =>
                    updateField("companyName", event.target.value)
                  }
                />
                <FormInput
                  label="Buyer type"
                  value={draft.companyType}
                  onChange={event =>
                    updateField("companyType", event.target.value)
                  }
                />
                <div className="md:col-span-2">
                  <FormInput
                    label="Pitch goal"
                    value={draft.pitchGoal}
                    onChange={event =>
                      updateField("pitchGoal", event.target.value)
                    }
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4 rounded-[24px] border border-[rgba(232,220,198,0.18)] bg-[rgba(6,12,24,0.55)] p-6 text-white">
              <div className="space-y-1">
                <div className="text-[10px] uppercase tracking-[0.16em] text-[rgba(229,170,20,0.72)]">
                  Demo Hub Copy
                </div>
                <h2 className="text-xl font-semibold tracking-tight">
                  Hero and spotlight
                </h2>
              </div>

              <div className="grid gap-3">
                <FormInput
                  label="Hero title"
                  value={draft.heroTitle}
                  onChange={event =>
                    updateField("heroTitle", event.target.value)
                  }
                />
                <TextAreaField
                  label="Hero subtitle"
                  value={draft.heroSubtitle}
                  onChange={heroSubtitle =>
                    updateField("heroSubtitle", heroSubtitle)
                  }
                />
                <FormInput
                  label="Spotlight title"
                  value={draft.spotlightTitle}
                  onChange={event =>
                    updateField("spotlightTitle", event.target.value)
                  }
                />
                <TextAreaField
                  label="Spotlight body"
                  value={draft.spotlightBody}
                  onChange={spotlightBody =>
                    updateField("spotlightBody", spotlightBody)
                  }
                />
              </div>
            </div>

            <div className="space-y-4 rounded-[24px] border border-[rgba(232,220,198,0.18)] bg-[rgba(6,12,24,0.55)] p-6 text-white">
              <div className="space-y-1">
                <div className="text-[10px] uppercase tracking-[0.16em] text-[rgba(229,170,20,0.72)]">
                  Talking Points
                </div>
                <h2 className="text-xl font-semibold tracking-tight">
                  Priority cards
                </h2>
              </div>

              <div className="grid gap-3">
                <FormInput
                  label="Priority one"
                  value={draft.priorityOne}
                  onChange={event =>
                    updateField("priorityOne", event.target.value)
                  }
                />
                <FormInput
                  label="Priority two"
                  value={draft.priorityTwo}
                  onChange={event =>
                    updateField("priorityTwo", event.target.value)
                  }
                />
                <FormInput
                  label="Priority three"
                  value={draft.priorityThree}
                  onChange={event =>
                    updateField("priorityThree", event.target.value)
                  }
                />
              </div>
            </div>

            <div className="space-y-4 rounded-[24px] border border-[rgba(232,220,198,0.18)] bg-[rgba(6,12,24,0.55)] p-6 text-white">
              <div className="space-y-1">
                <div className="text-[10px] uppercase tracking-[0.16em] text-[rgba(229,170,20,0.72)]">
                  Section Labels
                </div>
                <h2 className="text-xl font-semibold tracking-tight">
                  Demo navigation framing
                </h2>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <FormInput
                  label="Passcodes label"
                  value={draft.passcodesSectionLabel}
                  onChange={event =>
                    updateField(
                      "passcodesSectionLabel",
                      event.target.value
                    )
                  }
                />
                <FormInput
                  label="Simulator label"
                  value={draft.simulatorSectionLabel}
                  onChange={event =>
                    updateField(
                      "simulatorSectionLabel",
                      event.target.value
                    )
                  }
                />
                <FormInput
                  label="Customer section label"
                  value={draft.customerSectionLabel}
                  onChange={event =>
                    updateField(
                      "customerSectionLabel",
                      event.target.value
                    )
                  }
                />
                <FormInput
                  label="Staff section label"
                  value={draft.staffSectionLabel}
                  onChange={event =>
                    updateField("staffSectionLabel", event.target.value)
                  }
                />
              </div>
            </div>

            <div className="space-y-4 rounded-[24px] border border-[rgba(232,220,198,0.18)] bg-[rgba(6,12,24,0.55)] p-6 text-white">
              <div className="space-y-1">
                <div className="text-[10px] uppercase tracking-[0.16em] text-[rgba(229,170,20,0.72)]">
                  Customer Route Copy
                </div>
                <h2 className="text-xl font-semibold tracking-tight">
                  Guest-side navigation tiles
                </h2>
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                {DEMO_CUSTOMER_ROUTE_DEFINITIONS.map(route => (
                  <RouteCopyEditor
                    key={route.key}
                    title={route.nextPath}
                    routeKey={route.key}
                    value={draft.customerRoutes[route.key]}
                    onChange={updateCustomerRoute}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-4 rounded-[24px] border border-[rgba(232,220,198,0.18)] bg-[rgba(6,12,24,0.55)] p-6 text-white">
              <div className="space-y-1">
                <div className="text-[10px] uppercase tracking-[0.16em] text-[rgba(229,170,20,0.72)]">
                  Staff Route Copy
                </div>
                <h2 className="text-xl font-semibold tracking-tight">
                  Ops-side navigation tiles
                </h2>
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                {DEMO_STAFF_ROUTE_DEFINITIONS.map(route => (
                  <RouteCopyEditor
                    key={route.key}
                    title={route.nextPath}
                    routeKey={route.key}
                    value={draft.staffRoutes[route.key]}
                    onChange={updateStaffRoute}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4 xl:sticky xl:top-5 xl:self-start">
            <div className="space-y-4 rounded-[24px] border border-[rgba(229,170,20,0.3)] bg-[rgba(6,12,24,0.55)] p-6 text-white">
              <div className="space-y-1">
                <div className="text-[10px] uppercase tracking-[0.16em] text-[rgba(229,170,20,0.72)]">
                  Live Preview
                </div>
                <h2 className="text-xl font-semibold tracking-tight">
                  What `/demo` will show
                </h2>
              </div>

              <div className="rounded-2xl border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.04)] p-4">
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full border border-[rgba(229,170,20,0.34)] bg-[rgba(229,170,20,0.1)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#e5aa14]">
                    {preview.companyName}
                  </span>
                  <span className="rounded-full border border-[rgba(255,255,255,0.16)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[rgba(255,255,255,0.72)]">
                    {preview.companyType}
                  </span>
                </div>
                <div className="mt-3 text-2xl font-semibold tracking-tight">
                  {preview.heroTitle}
                </div>
                <p className="mt-2 text-sm leading-6 text-[rgba(255,255,255,0.72)]">
                  {preview.heroSubtitle}
                </p>
                <div className="mt-4 rounded-xl border border-[rgba(229,170,20,0.18)] bg-[rgba(0,0,0,0.12)] p-3">
                  <div className="text-sm font-semibold text-white">
                    {preview.spotlightTitle}
                  </div>
                  <p className="mt-1 text-xs leading-5 text-[rgba(255,255,255,0.72)]">
                    {preview.spotlightBody}
                  </p>
                </div>
                <div className="mt-3 text-xs uppercase tracking-[0.14em] text-[rgba(229,170,20,0.7)]">
                  {preview.pitchGoal}
                </div>
              </div>

              <div className="space-y-2">
                {[preview.priorityOne, preview.priorityTwo, preview.priorityThree].map(
                  item => (
                    <div
                      key={item}
                      className="rounded-xl border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.04)] px-3 py-2 text-sm text-[rgba(255,255,255,0.78)]"
                    >
                      {item}
                    </div>
                  )
                )}
              </div>

              <div className="rounded-xl border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.04)] p-4 text-sm text-[rgba(255,255,255,0.74)]">
                <div>Saved locally in this browser.</div>
                <div className="mt-1">
                  {savedAt
                    ? `Last saved at ${savedAt}.`
                    : loaded
                      ? "No new save in this session yet."
                      : "Loading saved setup..."}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button onClick={saveDraft} className="flex-1">
                  Save setup
                </Button>
                <Link
                  href="/demo"
                  className="focus-ring inline-flex min-h-[44px] flex-1 items-center justify-center rounded-[var(--radius-control)] border border-[var(--border)] bg-[rgba(255,255,255,0.06)] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[rgba(255,255,255,0.12)]"
                >
                  Preview demo
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
