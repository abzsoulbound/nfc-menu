"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { fetchJson } from "@/lib/fetchJson"
import type {
  CustomerExperienceConfig,
  LaunchReadiness,
} from "@/lib/types"

type RestaurantCustomizationPayload = {
  slug: string
  name: string
  monogram: string
  location: string | null
  assets: {
    logoUrl?: string
    heroUrl?: string
  }
  experienceConfig: CustomerExperienceConfig
  launchReadiness: LaunchReadiness
}

const fieldClass =
  "w-full rounded-[var(--radius-control)] border border-[rgba(120,161,234,0.36)] bg-[rgba(20,34,58,0.54)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[rgba(138,180,255,0.72)]"
const textareaClass = `${fieldClass} min-h-[80px]`

export default function ManagerCustomizePage() {
  const [slug, setSlug] = useState("")
  const [name, setName] = useState("")
  const [location, setLocation] = useState("")
  const [logoUrl, setLogoUrl] = useState("")
  const [heroUrl, setHeroUrl] = useState("")
  const [config, setConfig] = useState<CustomerExperienceConfig | null>(null)
  const [launchReadiness, setLaunchReadiness] =
    useState<LaunchReadiness | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    fetchJson<RestaurantCustomizationPayload>("/api/restaurant", {
      cache: "no-store",
    })
      .then(payload => {
        if (cancelled) return
        setSlug(payload.slug)
        setName(payload.name)
        setLocation(payload.location ?? "")
        setLogoUrl(payload.assets.logoUrl ?? "")
        setHeroUrl(payload.assets.heroUrl ?? "")
        setConfig(payload.experienceConfig)
        setLaunchReadiness(payload.launchReadiness)
      })
      .catch(err => {
        if (cancelled) return
        setError((err as Error).message)
      })
      .finally(() => {
        if (cancelled) return
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  async function save() {
    if (!config) return
    setBusy(true)
    setError(null)
    try {
      const updated = await fetchJson<RestaurantCustomizationPayload>(
        "/api/restaurant",
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            name,
            location: location.trim() || null,
            logoUrl: logoUrl.trim() || null,
            heroUrl: heroUrl.trim() || null,
            experienceConfig: config,
          }),
        }
      )
      setName(updated.name)
      setLocation(updated.location ?? "")
      setLogoUrl(updated.assets.logoUrl ?? "")
      setHeroUrl(updated.assets.heroUrl ?? "")
      setConfig(updated.experienceConfig)
      setLaunchReadiness(updated.launchReadiness)
      setSavedAt(new Date().toLocaleTimeString())
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function resetExperienceDefaults() {
    setBusy(true)
    setError(null)
    try {
      const updated = await fetchJson<RestaurantCustomizationPayload>(
        "/api/restaurant",
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            experienceConfig: null,
          }),
        }
      )
      setConfig(updated.experienceConfig)
      setLaunchReadiness(updated.launchReadiness)
      setSavedAt(new Date().toLocaleTimeString())
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function publishTenant() {
    if (!config) return
    setPublishing(true)
    setError(null)
    try {
      const updated = await fetchJson<RestaurantCustomizationPayload>(
        "/api/restaurant",
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            publish: true,
          }),
        }
      )
      setConfig(updated.experienceConfig)
      setLaunchReadiness(updated.launchReadiness)
      setSavedAt(new Date().toLocaleTimeString())
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setPublishing(false)
    }
  }

  if (loading || !config) {
    return (
      <div className="relative px-4 py-5 md:px-6 md:py-6">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-12 top-14 h-44 w-44 rounded-full bg-[radial-gradient(circle,rgba(96,138,214,0.22),rgba(96,138,214,0))] blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-10 top-52 h-48 w-48 rounded-full bg-[radial-gradient(circle,rgba(103,162,236,0.2),rgba(103,162,236,0))] blur-3xl"
        />

        <div className="mx-auto max-w-[1180px]">
          <Card
            variant="elevated"
            className="border-[rgba(111,147,213,0.4)] bg-[linear-gradient(132deg,rgba(15,28,50,0.96),rgba(21,39,66,0.94),rgba(29,52,85,0.92))]"
          >
            <div className="text-sm text-[rgba(197,214,244,0.9)]">
              Loading customization settings...
            </div>
          </Card>
        </div>
      </div>
    )
  }

  const menuPrimaryLabel = config.menu.primaryCtaLabel.trim() || "Primary action"
  const menuSecondaryLabel =
    config.menu.secondaryCtaLabel.trim() || "Secondary action"

  return (
    <div className="relative px-4 py-5 md:px-6 md:py-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-12 top-14 h-44 w-44 rounded-full bg-[radial-gradient(circle,rgba(96,138,214,0.22),rgba(96,138,214,0))] blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 top-52 h-48 w-48 rounded-full bg-[radial-gradient(circle,rgba(103,162,236,0.2),rgba(103,162,236,0))] blur-3xl"
      />

      <div className="mx-auto max-w-[1180px] space-y-4">
        <Card
          variant="elevated"
          className="border-[rgba(111,147,213,0.4)] bg-[linear-gradient(132deg,rgba(15,28,50,0.96),rgba(21,39,66,0.94),rgba(29,52,85,0.92))]"
        >
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div className="space-y-2">
              <div className="text-[10px] uppercase tracking-[0.18em] text-[rgba(184,205,244,0.82)]">
                Experience Customization
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-[#eef4ff] md:text-4xl">
                Customer page customization
              </h1>
              <p className="max-w-3xl text-sm leading-6 text-[rgba(197,214,244,0.86)]">
                Configure guest-facing menu and review pages for{" "}
                <span className="mono-font">{slug}</span>.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/manager"
                className="focus-ring inline-flex min-h-[38px] items-center justify-center rounded-[var(--radius-control)] border border-[rgba(114,153,225,0.56)] bg-[rgba(29,50,81,0.76)] px-3 text-xs font-semibold text-[#dce9ff] transition-colors hover:bg-[rgba(41,67,108,0.92)]"
              >
                Back to manager
              </Link>
              <Link
                href="/menu"
                className="focus-ring inline-flex min-h-[38px] items-center justify-center rounded-[var(--radius-control)] border border-[rgba(114,153,225,0.56)] bg-[rgba(29,50,81,0.76)] px-3 text-xs font-semibold text-[#dce9ff] transition-colors hover:bg-[rgba(41,67,108,0.92)]"
              >
                Menu preview
              </Link>
              <Link
                href="/order/takeaway"
                className="focus-ring inline-flex min-h-[38px] items-center justify-center rounded-[var(--radius-control)] border border-[rgba(114,153,225,0.56)] bg-[rgba(29,50,81,0.76)] px-3 text-xs font-semibold text-[#dce9ff] transition-colors hover:bg-[rgba(41,67,108,0.92)]"
              >
                Review preview
              </Link>
            </div>
          </div>
        </Card>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
          <div className="space-y-4">
            {error ? (
              <div className="status-chip status-chip-danger inline-flex">
                {error}
              </div>
            ) : null}
            {savedAt ? (
              <div className="status-chip status-chip-success inline-flex">
                Saved at {savedAt}
              </div>
            ) : null}

            <Card className="space-y-4 border-[rgba(114,153,225,0.34)] bg-[rgba(16,27,47,0.72)]">
              <div className="space-y-1">
                <div className="text-[10px] uppercase tracking-[0.16em] text-[rgba(160,189,237,0.86)]">
                  Brand Setup
                </div>
                <h2 className="text-lg font-semibold tracking-tight text-[#e8f1ff]">
                  Restaurant identity
                </h2>
                <p className="text-sm text-[rgba(183,205,239,0.78)]">
                  These values appear across customer menu and order review pages.
                </p>
              </div>

              <div className="grid gap-2 md:grid-cols-2">
                <label className="space-y-1 text-sm">
                  <span className="font-medium">Restaurant name</span>
                  <input
                    className={fieldClass}
                    value={name}
                    onChange={event => setName(event.target.value)}
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-medium">Location</span>
                  <input
                    className={fieldClass}
                    value={location}
                    onChange={event => setLocation(event.target.value)}
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-medium">Logo URL</span>
                  <input
                    className={fieldClass}
                    value={logoUrl}
                    onChange={event => setLogoUrl(event.target.value)}
                    placeholder="/brand/logo.png or https://..."
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-medium">Hero image URL</span>
                  <input
                    className={fieldClass}
                    value={heroUrl}
                    onChange={event => setHeroUrl(event.target.value)}
                    placeholder="/images/hero.jpg or https://..."
                  />
                </label>
              </div>
            </Card>

            <Card className="space-y-4 border-[rgba(114,153,225,0.34)] bg-[rgba(16,27,47,0.72)]">
              <div className="space-y-1">
                <div className="text-[10px] uppercase tracking-[0.16em] text-[rgba(160,189,237,0.86)]">
                  Theme
                </div>
                <h2 className="text-lg font-semibold tracking-tight text-[#e8f1ff]">
                  Customizable UX tokens
                </h2>
                <p className="text-sm text-[rgba(183,205,239,0.78)]">
                  Configure colors, radius style, and font tone per restaurant.
                </p>
              </div>

              <div className="grid gap-2 md:grid-cols-2">
                <label className="space-y-1 text-sm">
                  <span className="font-medium">Font preset</span>
                  <select
                    className={fieldClass}
                    value={config.theme.fontPreset}
                    onChange={event =>
                      setConfig(prev =>
                        prev
                          ? {
                              ...prev,
                              theme: {
                                ...prev.theme,
                                fontPreset: event.target
                                  .value as CustomerExperienceConfig["theme"]["fontPreset"],
                              },
                            }
                          : prev
                      )
                    }
                  >
                    <option value="SANS">Sans</option>
                    <option value="SERIF">Serif</option>
                    <option value="MONO">Mono</option>
                  </select>
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-medium">Radius preset</span>
                  <select
                    className={fieldClass}
                    value={config.theme.radiusPreset}
                    onChange={event =>
                      setConfig(prev =>
                        prev
                          ? {
                              ...prev,
                              theme: {
                                ...prev.theme,
                                radiusPreset: event.target
                                  .value as CustomerExperienceConfig["theme"]["radiusPreset"],
                              },
                            }
                          : prev
                      )
                    }
                  >
                    <option value="SOFT">Soft</option>
                    <option value="ROUND">Round</option>
                    <option value="SHARP">Sharp</option>
                  </select>
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-medium">Customer primary</span>
                  <input
                    type="color"
                    className={`${fieldClass} h-10 p-1`}
                    value={config.theme.customerPrimary}
                    onChange={event =>
                      setConfig(prev =>
                        prev
                          ? {
                              ...prev,
                              theme: {
                                ...prev.theme,
                                customerPrimary: event.target.value,
                              },
                            }
                          : prev
                      )
                    }
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-medium">Customer surface</span>
                  <input
                    type="color"
                    className={`${fieldClass} h-10 p-1`}
                    value={config.theme.customerSurface}
                    onChange={event =>
                      setConfig(prev =>
                        prev
                          ? {
                              ...prev,
                              theme: {
                                ...prev.theme,
                                customerSurface: event.target.value,
                              },
                            }
                          : prev
                      )
                    }
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-medium">Customer text</span>
                  <input
                    type="color"
                    className={`${fieldClass} h-10 p-1`}
                    value={config.theme.customerText}
                    onChange={event =>
                      setConfig(prev =>
                        prev
                          ? {
                              ...prev,
                              theme: {
                                ...prev.theme,
                                customerText: event.target.value,
                              },
                            }
                          : prev
                      )
                    }
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-medium">Customer focus</span>
                  <input
                    type="color"
                    className={`${fieldClass} h-10 p-1`}
                    value={config.theme.customerFocus}
                    onChange={event =>
                      setConfig(prev =>
                        prev
                          ? {
                              ...prev,
                              theme: {
                                ...prev.theme,
                                customerFocus: event.target.value,
                              },
                            }
                          : prev
                      )
                    }
                  />
                </label>
                <label className="space-y-1 text-sm md:col-span-2">
                  <span className="font-medium">Staff action accent</span>
                  <input
                    type="color"
                    className={`${fieldClass} h-10 p-1`}
                    value={config.theme.staffPrimary}
                    onChange={event =>
                      setConfig(prev =>
                        prev
                          ? {
                              ...prev,
                              theme: {
                                ...prev.theme,
                                staffPrimary: event.target.value,
                              },
                            }
                          : prev
                      )
                    }
                  />
                </label>
              </div>
            </Card>

            <Card className="space-y-4 border-[rgba(114,153,225,0.34)] bg-[rgba(16,27,47,0.72)]">
              <div className="space-y-1">
                <div className="text-[10px] uppercase tracking-[0.16em] text-[rgba(160,189,237,0.86)]">
                  UX Flow
                </div>
                <h2 className="text-lg font-semibold tracking-tight text-[#e8f1ff]">
                  Behavioral journey controls
                </h2>
                <p className="text-sm text-[rgba(183,205,239,0.78)]">
                  Choose the flow architecture per restaurant to match guest behavior and service style.
                </p>
              </div>

              <div className="grid gap-2 md:grid-cols-2">
                <label className="space-y-1 text-sm">
                  <span className="font-medium">Menu discovery flow</span>
                  <select
                    className={fieldClass}
                    value={config.ux.menuDiscovery}
                    onChange={event =>
                      setConfig(prev =>
                        prev
                          ? {
                              ...prev,
                              ux: {
                                ...prev.ux,
                                menuDiscovery: event.target
                                  .value as CustomerExperienceConfig["ux"]["menuDiscovery"],
                              },
                            }
                          : prev
                      )
                    }
                  >
                    <option value="HERO_FIRST">Hero-first</option>
                    <option value="SECTION_FIRST">Section-first</option>
                    <option value="SEARCH_FIRST">Search-first</option>
                  </select>
                </label>

                <label className="space-y-1 text-sm">
                  <span className="font-medium">Ordering flow</span>
                  <select
                    className={fieldClass}
                    value={config.ux.ordering}
                    onChange={event =>
                      setConfig(prev =>
                        prev
                          ? {
                              ...prev,
                              ux: {
                                ...prev.ux,
                                ordering: event.target
                                  .value as CustomerExperienceConfig["ux"]["ordering"],
                              },
                            }
                          : prev
                      )
                    }
                  >
                    <option value="BOTTOM_SHEET_FAST">Bottom-sheet fast</option>
                    <option value="INLINE_STEPPER">Inline quick add</option>
                    <option value="GUIDED_CONFIGURATOR">Guided configurator</option>
                  </select>
                </label>

                <label className="space-y-1 text-sm">
                  <span className="font-medium">Review flow</span>
                  <select
                    className={fieldClass}
                    value={config.ux.review}
                    onChange={event =>
                      setConfig(prev =>
                        prev
                          ? {
                              ...prev,
                              ux: {
                                ...prev.ux,
                                review: event.target
                                  .value as CustomerExperienceConfig["ux"]["review"],
                              },
                            }
                          : prev
                      )
                    }
                  >
                    <option value="SHEET_REVIEW">Bottom-sheet review</option>
                    <option value="PAGE_REVIEW">Full-page review</option>
                  </select>
                </label>

                <label className="space-y-1 text-sm">
                  <span className="font-medium">Checkout flow</span>
                  <select
                    className={fieldClass}
                    value={config.ux.checkout}
                    onChange={event =>
                      setConfig(prev =>
                        prev
                          ? {
                              ...prev,
                              ux: {
                                ...prev.ux,
                                checkout: event.target
                                  .value as CustomerExperienceConfig["ux"]["checkout"],
                              },
                            }
                          : prev
                      )
                    }
                  >
                    <option value="ONE_PAGE">One-page</option>
                    <option value="GUIDED_SPLIT">Guided split</option>
                    <option value="EXPRESS_FIRST">Express-first</option>
                  </select>
                </label>

                <label className="space-y-1 text-sm">
                  <span className="font-medium">Engagement flow</span>
                  <select
                    className={fieldClass}
                    value={config.ux.engagement}
                    onChange={event =>
                      setConfig(prev =>
                        prev
                          ? {
                              ...prev,
                              ux: {
                                ...prev.ux,
                                engagement: event.target
                                  .value as CustomerExperienceConfig["ux"]["engagement"],
                              },
                            }
                          : prev
                      )
                    }
                  >
                    <option value="ALL_IN_ONE">All in one</option>
                    <option value="TASK_TABS">Task tabs</option>
                    <option value="POST_PURCHASE_PROMPT">Post-purchase prompt</option>
                  </select>
                </label>

                <label className="space-y-1 text-sm">
                  <span className="font-medium">Trust microcopy level</span>
                  <select
                    className={fieldClass}
                    value={config.ux.trustMicrocopy}
                    onChange={event =>
                      setConfig(prev =>
                        prev
                          ? {
                              ...prev,
                              ux: {
                                ...prev.ux,
                                trustMicrocopy: event.target
                                  .value as CustomerExperienceConfig["ux"]["trustMicrocopy"],
                              },
                            }
                          : prev
                      )
                    }
                  >
                    <option value="MINIMAL">Minimal</option>
                    <option value="BALANCED">Balanced</option>
                    <option value="HIGH_ASSURANCE">High assurance</option>
                  </select>
                </label>
              </div>

              <div className="grid gap-2 md:grid-cols-2">
                <label className="space-y-1 text-sm">
                  <span className="font-medium">Default tip %</span>
                  <input
                    type="number"
                    min={0}
                    max={30}
                    step={0.5}
                    className={fieldClass}
                    value={String(config.ux.defaultTipPercent)}
                    onChange={event =>
                      setConfig(prev => {
                        if (!prev) return prev
                        const parsed = Number(event.target.value)
                        return {
                          ...prev,
                          ux: {
                            ...prev.ux,
                            defaultTipPercent: Number.isFinite(parsed)
                              ? Math.max(
                                  0,
                                  Math.min(
                                    30,
                                    Number(parsed.toFixed(2))
                                  )
                                )
                              : prev.ux.defaultTipPercent,
                          },
                        }
                      })
                    }
                  />
                </label>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <label className="inline-flex items-center gap-2 rounded-[var(--radius-control)] border border-[rgba(120,161,234,0.3)] bg-[rgba(20,34,58,0.45)] px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={config.ux.showProgressAnchors}
                    onChange={event =>
                      setConfig(prev =>
                        prev
                          ? {
                              ...prev,
                              ux: {
                                ...prev.ux,
                                showProgressAnchors: event.target.checked,
                              },
                            }
                          : prev
                      )
                    }
                  />
                  Show progress anchors
                </label>
                <label className="inline-flex items-center gap-2 rounded-[var(--radius-control)] border border-[rgba(120,161,234,0.3)] bg-[rgba(20,34,58,0.45)] px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={config.ux.emphasizeSocialProof}
                    onChange={event =>
                      setConfig(prev =>
                        prev
                          ? {
                              ...prev,
                              ux: {
                                ...prev.ux,
                                emphasizeSocialProof: event.target.checked,
                              },
                            }
                          : prev
                      )
                    }
                  />
                  Emphasize social proof
                </label>
              </div>
            </Card>

            <Card className="space-y-4 border-[rgba(114,153,225,0.34)] bg-[rgba(16,27,47,0.72)]">
              <div className="space-y-1">
                <div className="text-[10px] uppercase tracking-[0.16em] text-[rgba(160,189,237,0.86)]">
                  Menu Page
                </div>
                <h2 className="text-lg font-semibold tracking-tight text-[#e8f1ff]">
                  Hero and call-to-actions
                </h2>
              </div>

              <div className="grid gap-2 md:grid-cols-2">
                <label className="space-y-1 text-sm md:col-span-2">
                  <span className="font-medium">Hero title</span>
                  <input
                    className={fieldClass}
                    value={config.menu.heroTitle}
                    onChange={event =>
                      setConfig(prev =>
                        prev
                          ? {
                              ...prev,
                              menu: {
                                ...prev.menu,
                                heroTitle: event.target.value,
                              },
                            }
                          : prev
                      )
                    }
                  />
                </label>
                <label className="space-y-1 text-sm md:col-span-2">
                  <span className="font-medium">Hero subtitle</span>
                  <textarea
                    className={textareaClass}
                    value={config.menu.heroSubtitle}
                    onChange={event =>
                      setConfig(prev =>
                        prev
                          ? {
                              ...prev,
                              menu: {
                                ...prev.menu,
                                heroSubtitle: event.target.value,
                              },
                            }
                          : prev
                      )
                    }
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-medium">Primary CTA label</span>
                  <input
                    className={fieldClass}
                    value={config.menu.primaryCtaLabel}
                    onChange={event =>
                      setConfig(prev =>
                        prev
                          ? {
                              ...prev,
                              menu: {
                                ...prev.menu,
                                primaryCtaLabel: event.target.value,
                              },
                            }
                          : prev
                      )
                    }
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-medium">Primary CTA link</span>
                  <input
                    className={fieldClass}
                    value={config.menu.primaryCtaHref}
                    onChange={event =>
                      setConfig(prev =>
                        prev
                          ? {
                              ...prev,
                              menu: {
                                ...prev.menu,
                                primaryCtaHref: event.target.value,
                              },
                            }
                          : prev
                      )
                    }
                    placeholder="/guest-tools"
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-medium">Secondary CTA label</span>
                  <input
                    className={fieldClass}
                    value={config.menu.secondaryCtaLabel}
                    onChange={event =>
                      setConfig(prev =>
                        prev
                          ? {
                              ...prev,
                              menu: {
                                ...prev.menu,
                                secondaryCtaLabel: event.target.value,
                              },
                            }
                          : prev
                      )
                    }
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-medium">Secondary CTA link</span>
                  <input
                    className={fieldClass}
                    value={config.menu.secondaryCtaHref}
                    onChange={event =>
                      setConfig(prev =>
                        prev
                          ? {
                              ...prev,
                              menu: {
                                ...prev.menu,
                                secondaryCtaHref: event.target.value,
                              },
                            }
                          : prev
                      )
                    }
                    placeholder="/pay/1"
                  />
                </label>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="inline-flex items-center gap-2 rounded-[var(--radius-control)] border border-[rgba(120,161,234,0.3)] bg-[rgba(20,34,58,0.45)] px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={config.menu.showMetaStats}
                    onChange={event =>
                      setConfig(prev =>
                        prev
                          ? {
                              ...prev,
                              menu: {
                                ...prev.menu,
                                showMetaStats: event.target.checked,
                              },
                            }
                          : prev
                      )
                    }
                  />
                  Show section/item stats
                </label>
                <label className="inline-flex items-center gap-2 rounded-[var(--radius-control)] border border-[rgba(120,161,234,0.3)] bg-[rgba(20,34,58,0.45)] px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={config.menu.showPlaceholderNote}
                    onChange={event =>
                      setConfig(prev =>
                        prev
                          ? {
                              ...prev,
                              menu: {
                                ...prev.menu,
                                showPlaceholderNote: event.target.checked,
                              },
                            }
                          : prev
                      )
                    }
                  />
                  Show placeholder image notice
                </label>
              </div>
            </Card>

            <Card className="space-y-4 border-[rgba(114,153,225,0.34)] bg-[rgba(16,27,47,0.72)]">
              <div className="space-y-1">
                <div className="text-[10px] uppercase tracking-[0.16em] text-[rgba(160,189,237,0.86)]">
                  Review Page
                </div>
                <h2 className="text-lg font-semibold tracking-tight text-[#e8f1ff]">
                  Checkout confirmation messaging
                </h2>
              </div>

              <div className="grid gap-2 md:grid-cols-2">
                <label className="space-y-1 text-sm md:col-span-2">
                  <span className="font-medium">Page title</span>
                  <input
                    className={fieldClass}
                    value={config.review.title}
                    onChange={event =>
                      setConfig(prev =>
                        prev
                          ? {
                              ...prev,
                              review: {
                                ...prev.review,
                                title: event.target.value,
                              },
                            }
                          : prev
                      )
                    }
                  />
                </label>
                <label className="space-y-1 text-sm md:col-span-2">
                  <span className="font-medium">Dine-in subtitle</span>
                  <textarea
                    className={textareaClass}
                    value={config.review.subtitleDineIn}
                    onChange={event =>
                      setConfig(prev =>
                        prev
                          ? {
                              ...prev,
                              review: {
                                ...prev.review,
                                subtitleDineIn: event.target.value,
                              },
                            }
                          : prev
                      )
                    }
                  />
                </label>
                <label className="space-y-1 text-sm md:col-span-2">
                  <span className="font-medium">Takeaway subtitle</span>
                  <textarea
                    className={textareaClass}
                    value={config.review.subtitleTakeaway}
                    onChange={event =>
                      setConfig(prev =>
                        prev
                          ? {
                              ...prev,
                              review: {
                                ...prev.review,
                                subtitleTakeaway: event.target.value,
                              },
                            }
                          : prev
                      )
                    }
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-medium">Place order button</span>
                  <input
                    className={fieldClass}
                    value={config.review.placeOrderLabel}
                    onChange={event =>
                      setConfig(prev =>
                        prev
                          ? {
                              ...prev,
                              review: {
                                ...prev.review,
                                placeOrderLabel: event.target.value,
                              },
                            }
                          : prev
                      )
                    }
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-medium">Back button</span>
                  <input
                    className={fieldClass}
                    value={config.review.backLabel}
                    onChange={event =>
                      setConfig(prev =>
                        prev
                          ? {
                              ...prev,
                              review: {
                                ...prev.review,
                                backLabel: event.target.value,
                              },
                            }
                          : prev
                      )
                    }
                  />
                </label>
                <label className="space-y-1 text-sm md:col-span-2">
                  <span className="font-medium">Dine-in confirmation text</span>
                  <textarea
                    className={textareaClass}
                    value={config.review.confirmDineIn}
                    onChange={event =>
                      setConfig(prev =>
                        prev
                          ? {
                              ...prev,
                              review: {
                                ...prev.review,
                                confirmDineIn: event.target.value,
                              },
                            }
                          : prev
                      )
                    }
                  />
                </label>
                <label className="space-y-1 text-sm md:col-span-2">
                  <span className="font-medium">Takeaway confirmation text</span>
                  <textarea
                    className={textareaClass}
                    value={config.review.confirmTakeaway}
                    onChange={event =>
                      setConfig(prev =>
                        prev
                          ? {
                              ...prev,
                              review: {
                                ...prev.review,
                                confirmTakeaway: event.target.value,
                              },
                            }
                          : prev
                      )
                    }
                  />
                </label>
              </div>
              <label className="inline-flex items-center gap-2 rounded-[var(--radius-control)] border border-[rgba(120,161,234,0.3)] bg-[rgba(20,34,58,0.45)] px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={config.review.showAllergens}
                  onChange={event =>
                    setConfig(prev =>
                      prev
                        ? {
                            ...prev,
                            review: {
                              ...prev.review,
                              showAllergens: event.target.checked,
                            },
                          }
                        : prev
                    )
                  }
                />
                Show allergen details in review
              </label>
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="space-y-3 border-[rgba(114,153,225,0.38)] bg-[rgba(16,27,47,0.8)] xl:sticky xl:top-4">
              <div className="space-y-1">
                <div className="text-[10px] uppercase tracking-[0.16em] text-[rgba(160,189,237,0.86)]">
                  Publish
                </div>
                <h2 className="text-lg font-semibold tracking-tight text-[#e8f1ff]">
                  Apply customization
                </h2>
                <p className="text-sm text-[rgba(183,205,239,0.78)]">
                  Changes apply immediately to guest pages for this restaurant.
                </p>
                <div className="text-xs text-[rgba(183,205,239,0.74)]">
                  Public launch status:{" "}
                  <span className="font-semibold text-[#dce9ff]">
                    {config.launch.isPublished ? "Published" : "Setup mode"}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={busy || publishing}
                  onClick={() => save().catch(() => {})}
                >
                  {busy ? "Saving..." : "Save customization"}
                </Button>
                <Button
                  variant="quiet"
                  disabled={busy || publishing}
                  onClick={() => resetExperienceDefaults().catch(() => {})}
                >
                  Reset to defaults
                </Button>
                <Button
                  variant="secondary"
                  disabled={
                    busy ||
                    publishing ||
                    (launchReadiness ? !launchReadiness.ready : true)
                  }
                  onClick={() => publishTenant().catch(() => {})}
                >
                  {publishing ? "Publishing..." : "Publish tenant"}
                </Button>
              </div>
            </Card>

            {launchReadiness ? (
              <Card className="space-y-3 border-[rgba(114,153,225,0.34)] bg-[rgba(16,27,47,0.72)]">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-[rgba(160,189,237,0.86)]">
                    Go-Live Checklist
                  </div>
                  <span
                    className={`status-chip ${
                      launchReadiness.ready
                        ? "status-chip-success"
                        : "status-chip-warning"
                    }`}
                  >
                    {launchReadiness.score}% complete
                  </span>
                </div>
                <div className="space-y-2">
                  {launchReadiness.items.map(item => (
                    <div
                      key={item.id}
                      className="rounded-[var(--radius-control)] border border-[rgba(120,161,234,0.32)] bg-[rgba(20,34,58,0.46)] px-3 py-2"
                    >
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="font-medium text-[#e8f1ff]">
                          {item.label}
                        </span>
                        <span
                          className={`text-xs font-semibold ${
                            item.done
                              ? "text-[rgba(169,239,199,0.94)]"
                              : "text-[rgba(255,216,143,0.94)]"
                          }`}
                        >
                          {item.done ? "DONE" : "ACTION"}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-[rgba(183,205,239,0.74)]">
                        {item.detail}
                      </p>
                    </div>
                  ))}
                </div>
              </Card>
            ) : null}

            <Card className="space-y-3 border-[rgba(114,153,225,0.34)] bg-[rgba(16,27,47,0.72)]">
              <div className="text-[10px] uppercase tracking-[0.16em] text-[rgba(160,189,237,0.86)]">
                Menu Snapshot
              </div>
              <div className="rounded-[var(--radius-control)] border border-[rgba(120,161,234,0.3)] bg-[rgba(20,34,58,0.5)] p-3">
                <div className="text-sm font-semibold text-[#e8f1ff]">
                  {config.menu.heroTitle || "Hero title"}
                </div>
                <p className="mt-1 text-xs text-[rgba(183,205,239,0.76)]">
                  {config.menu.heroSubtitle || "Hero subtitle"}
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full border border-[rgba(120,161,234,0.38)] px-2 py-1 text-[rgba(202,220,247,0.9)]">
                    {menuPrimaryLabel}
                  </span>
                  <span className="rounded-full border border-[rgba(120,161,234,0.38)] px-2 py-1 text-[rgba(202,220,247,0.9)]">
                    {menuSecondaryLabel}
                  </span>
                </div>
              </div>
            </Card>

            <Card className="space-y-3 border-[rgba(114,153,225,0.34)] bg-[rgba(16,27,47,0.72)]">
              <div className="text-[10px] uppercase tracking-[0.16em] text-[rgba(160,189,237,0.86)]">
                UX Snapshot
              </div>
              <div className="rounded-[var(--radius-control)] border border-[rgba(120,161,234,0.3)] bg-[rgba(20,34,58,0.5)] p-3 text-xs text-[rgba(202,220,247,0.92)]">
                <div>Discovery: {config.ux.menuDiscovery}</div>
                <div>Ordering: {config.ux.ordering}</div>
                <div>Review: {config.ux.review}</div>
                <div>Checkout: {config.ux.checkout}</div>
                <div>Engagement: {config.ux.engagement}</div>
                <div>
                  Default tip: {config.ux.defaultTipPercent}% | Trust:{" "}
                  {config.ux.trustMicrocopy}
                </div>
              </div>
            </Card>

            <Card className="space-y-3 border-[rgba(114,153,225,0.34)] bg-[rgba(16,27,47,0.72)]">
              <div className="text-[10px] uppercase tracking-[0.16em] text-[rgba(160,189,237,0.86)]">
                Review Snapshot
              </div>
              <div className="rounded-[var(--radius-control)] border border-[rgba(120,161,234,0.3)] bg-[rgba(20,34,58,0.5)] p-3">
                <div className="text-sm font-semibold text-[#e8f1ff]">
                  {config.review.title || "Review title"}
                </div>
                <p className="mt-1 text-xs text-[rgba(183,205,239,0.76)]">
                  {config.review.subtitleDineIn || "Dine-in subtitle"}
                </p>
                <p className="mt-2 text-xs text-[rgba(183,205,239,0.7)]">
                  Button pair: {config.review.backLabel || "Back"} /{" "}
                  {config.review.placeOrderLabel || "Place order"}
                </p>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
