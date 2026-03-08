"use client"

import { useCallback, useEffect, useState } from "react"
import { Card } from "@/components/ui/Card"
import { fetchJson } from "@/lib/fetchJson"
import type {
  FeatureCategory,
  FeatureKey,
  FeatureMeta,
  FeatureValidationWarning,
  PlanTier,
} from "@/lib/featureFlags"

type CatalogEntry = FeatureMeta & {
  enabled: boolean
  availableOnPlan: boolean
  overridden: boolean
}

type FeaturesResponse = {
  slug: string
  planTier: PlanTier
  featureConfig: Record<string, boolean>
  resolvedFeatures: Record<string, boolean>
  warnings: FeatureValidationWarning[]
  catalog: CatalogEntry[]
  categories: { key: FeatureCategory; label: string }[]
}

export function FeatureManagement() {
  const [data, setData] = useState<FeaturesResponse | null>(null)
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<
    FeatureCategory | "all"
  >("all")

  const load = useCallback(() => {
    fetchJson<FeaturesResponse>("/api/restaurant/features", {
      cache: "no-store",
    })
      .then(setData)
      .catch(() => setError("Could not load feature configuration"))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const toggle = useCallback(
    async (key: FeatureKey, enabled: boolean) => {
      setSaving(prev => ({ ...prev, [key]: true }))
      try {
        const result = await fetchJson<FeaturesResponse>(
          "/api/restaurant/features",
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ features: { [key]: enabled } }),
          }
        )
        setData(prev =>
          prev
            ? {
                ...prev,
                featureConfig: result.featureConfig,
                resolvedFeatures: result.resolvedFeatures,
                warnings: result.warnings,
                catalog: prev.catalog.map(entry => ({
                  ...entry,
                  enabled: result.resolvedFeatures[entry.key] ?? false,
                  overridden:
                    result.featureConfig[entry.key] !== undefined,
                })),
              }
            : prev
        )
      } catch {
        setError("Failed to save feature toggle")
      } finally {
        setSaving(prev => ({ ...prev, [key]: false }))
      }
    },
    []
  )

  if (error && !data) {
    return (
      <Card>
        <div className="p-4 text-sm text-red-400">{error}</div>
      </Card>
    )
  }

  if (!data) {
    return (
      <Card>
        <div className="p-4 text-sm text-muted animate-pulse">
          Loading feature configuration…
        </div>
      </Card>
    )
  }

  const lowerFilter = filter.toLowerCase()
  const filteredCatalog = data.catalog.filter(entry => {
    if (
      categoryFilter !== "all" &&
      entry.category !== categoryFilter
    ) {
      return false
    }
    if (lowerFilter === "") return true
    return (
      entry.label.toLowerCase().includes(lowerFilter) ||
      entry.description.toLowerCase().includes(lowerFilter) ||
      entry.key.toLowerCase().includes(lowerFilter)
    )
  })

  // Group by category preserving order
  const grouped = new Map<FeatureCategory, CatalogEntry[]>()
  for (const entry of filteredCatalog) {
    const list = grouped.get(entry.category) ?? []
    list.push(entry)
    grouped.set(entry.category, list)
  }

  const categoryLabelMap = new Map(
    data.categories.map(c => [c.key, c.label])
  )

  const enabledCount = data.catalog.filter(e => e.enabled).length
  const totalCount = data.catalog.length

  return (
    <Card>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.14em] text-muted">
              Feature Modules
            </div>
            <div className="mt-1 text-xs text-muted">
              {enabledCount} of {totalCount} features enabled
              <span className="mx-2">·</span>
              Plan:{" "}
              <span className="font-semibold capitalize">
                {data.planTier}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <select
              value={categoryFilter}
              onChange={e =>
                setCategoryFilter(
                  e.target.value as FeatureCategory | "all"
                )
              }
              className="rounded-[var(--radius-control)] border border-[var(--border)] bg-transparent px-2 py-1 text-xs"
            >
              <option value="all">All categories</option>
              {data.categories.map(cat => (
                <option key={cat.key} value={cat.key}>
                  {cat.label}
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Filter features…"
              value={filter}
              onChange={e => setFilter(e.target.value)}
              className="rounded-[var(--radius-control)] border border-[var(--border)] bg-transparent px-3 py-1 text-xs placeholder:text-muted"
            />
          </div>
        </div>

        {/* Warnings */}
        {data.warnings.length > 0 && (
          <div className="rounded-[var(--radius-control)] border border-amber-500/40 bg-amber-500/10 px-3 py-2">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-400">
              Configuration warnings
            </div>
            <ul className="mt-1 space-y-1">
              {data.warnings.map((w, i) => (
                <li key={i} className="text-xs text-amber-300">
                  {w.message}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Feature toggles by category */}
        {Array.from(grouped.entries()).map(([cat, entries]) => (
          <div key={cat} className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
              {categoryLabelMap.get(cat) ?? cat}
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {entries.map(entry => {
                const isPlanLocked = !entry.availableOnPlan
                const isSaving = saving[entry.key] ?? false
                return (
                  <div
                    key={entry.key}
                    className={`rounded-[var(--radius-control)] border p-3 transition-colors ${
                      entry.enabled
                        ? "border-[var(--accent)]/40 bg-[var(--accent)]/5"
                        : "border-[var(--border)] surface-accent"
                    } ${isPlanLocked ? "opacity-50" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold leading-tight">
                            {entry.label}
                          </span>
                          {entry.overridden && (
                            <span className="shrink-0 rounded bg-blue-500/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-blue-400">
                              custom
                            </span>
                          )}
                          {isPlanLocked && entry.minPlan && (
                            <span className="shrink-0 rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-400">
                              {entry.minPlan}+
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs leading-snug text-muted">
                          {entry.description}
                        </p>
                        {entry.requires && entry.requires.length > 0 && (
                          <p className="mt-1 text-[10px] text-muted">
                            Requires:{" "}
                            {entry.requires.join(", ")}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={entry.enabled}
                        disabled={isPlanLocked || isSaving}
                        onClick={() =>
                          toggle(
                            entry.key,
                            !entry.enabled
                          )
                        }
                        className={`relative mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-1 disabled:cursor-not-allowed ${
                          entry.enabled
                            ? "bg-[var(--accent)]"
                            : "bg-[var(--border)]"
                        }`}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
                            entry.enabled
                              ? "translate-x-[18px]"
                              : "translate-x-[3px]"
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        {filteredCatalog.length === 0 && (
          <div className="py-6 text-center text-sm text-muted">
            No features match your filter.
          </div>
        )}

        {/* Error toast */}
        {error && (
          <div className="rounded-[var(--radius-control)] border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-400">
            {error}
            <button
              className="ml-2 underline"
              onClick={() => setError(null)}
            >
              dismiss
            </button>
          </div>
        )}
      </div>
    </Card>
  )
}
