"use client"

import { useEffect, useMemo, useState } from "react"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { Modal } from "@/components/ui/Modal"
import { fetchJson } from "@/lib/fetchJson"
import { MenuSection, Station } from "@/lib/types"

type ItemDraft = {
  name: string
  description: string
  basePrice: number
  station: Station
  active: boolean
  stockCount: number | null
}

type SectionDraft = Record<string, string>
type ItemDraftMap = Record<string, ItemDraft>

function toItemDraftMap(menu: MenuSection[]) {
  const draft: ItemDraftMap = {}
  for (const section of menu) {
    for (const item of section.items) {
      draft[item.id] = {
        name: item.name,
        description: item.description,
        basePrice: item.basePrice,
        station: item.station,
        active: item.active !== false,
        stockCount:
          typeof item.stockCount === "number"
            ? item.stockCount
            : null,
      }
    }
  }
  return draft
}

function toSectionDraft(menu: MenuSection[]) {
  const draft: SectionDraft = {}
  for (const section of menu) {
    draft[section.id] = section.name
  }
  return draft
}

export function MenuControls() {
  const [menu, setMenu] = useState<MenuSection[]>([])
  const [itemDrafts, setItemDrafts] = useState<ItemDraftMap>({})
  const [sectionDrafts, setSectionDrafts] = useState<SectionDraft>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const payload = await fetchJson<{
        menu: MenuSection[]
        locked: boolean
      }>("/api/menu?view=all", {
        cache: "no-store",
      })
      setMenu(payload.menu)
      setItemDrafts(toItemDraftMap(payload.menu))
      setSectionDrafts(toSectionDraft(payload.menu))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load().catch(() => {})
  }, [])

  const totalItems = useMemo(
    () => menu.reduce((sum, section) => sum + section.items.length, 0),
    [menu]
  )

  async function saveSection(sectionId: string) {
    const name = sectionDrafts[sectionId]?.trim() ?? ""
    if (!name) {
      setError("Section name is required")
      return
    }

    setBusyKey(`section:${sectionId}`)
    setError(null)
    try {
      await fetchJson("/api/menu", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "RENAME_SECTION",
          sectionId,
          name,
        }),
      })
      await load()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusyKey(null)
    }
  }

  async function saveItem(itemId: string) {
    const draft = itemDrafts[itemId]
    if (!draft) return

    setBusyKey(`item:${itemId}`)
    setError(null)
    try {
      await fetchJson("/api/menu", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "UPDATE_ITEM",
          itemId,
          name: draft.name.trim(),
          description: draft.description.trim(),
          basePrice: Number(draft.basePrice),
          station: draft.station,
          active: draft.active,
          stockCount: draft.stockCount,
        }),
      })
      await load()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusyKey(null)
    }
  }

  async function resetMenu() {
    setBusyKey("menu:reset")
    setError(null)
    try {
      await fetchJson("/api/menu", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "RESET_MENU",
        }),
      })
      setShowResetConfirm(false)
      await load()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusyKey(null)
    }
  }

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            Menu Controls
          </h2>
          <p className="text-sm text-secondary">
            Edit pricing, descriptions, station routing, and item visibility.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="neutral">{menu.length} sections</Badge>
          <Badge variant="neutral">{totalItems} items</Badge>
        </div>
      </div>

      {error && (
        <div className="status-chip status-chip-danger inline-flex">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          variant="quiet"
          onClick={() => load().catch(() => {})}
          disabled={loading || busyKey !== null}
        >
          Refresh
        </Button>
        <Button
          variant="danger"
          onClick={() => setShowResetConfirm(true)}
          disabled={loading || busyKey !== null}
        >
          Reset menu to default
        </Button>
      </div>

      {loading ? (
        <div className="py-6 text-sm text-secondary">Loading menu...</div>
      ) : (
        <div className="space-y-4">
          {menu.map(section => (
            <Card key={section.id} variant="accent" className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={sectionDrafts[section.id] ?? section.name}
                  onChange={event =>
                    setSectionDrafts(prev => ({
                      ...prev,
                      [section.id]: event.target.value,
                    }))
                  }
                  className="min-h-[42px] flex-1 rounded-[var(--radius-control)] border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
                />
                <Button
                  variant="secondary"
                  className="min-h-[42px]"
                  disabled={busyKey !== null}
                  onClick={() => saveSection(section.id).catch(() => {})}
                >
                  Save section
                </Button>
              </div>

              <div className="space-y-2">
                {section.items.map(item => {
                  const draft = itemDrafts[item.id]
                  if (!draft) return null

                  return (
                    <Card key={item.id} className="space-y-2">
                      <div className="grid gap-2 md:grid-cols-2">
                        <input
                          value={draft.name}
                          onChange={event =>
                            setItemDrafts(prev => ({
                              ...prev,
                              [item.id]: {
                                ...prev[item.id],
                                name: event.target.value,
                              },
                            }))
                          }
                          className="min-h-[40px] rounded-[var(--radius-control)] border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
                          placeholder="Item name"
                        />

                        <input
                          value={draft.description}
                          onChange={event =>
                            setItemDrafts(prev => ({
                              ...prev,
                              [item.id]: {
                                ...prev[item.id],
                                description: event.target.value,
                              },
                            }))
                          }
                          className="min-h-[40px] rounded-[var(--radius-control)] border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
                          placeholder="Description"
                        />
                      </div>

                      <div className="grid gap-2 md:grid-cols-5">
                        <label className="flex items-center gap-2 rounded-[var(--radius-control)] border border-[var(--border)] px-3 py-2 text-sm">
                          <span>£</span>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={Number.isFinite(draft.basePrice) ? draft.basePrice : 0}
                            onChange={event =>
                              setItemDrafts(prev => ({
                                ...prev,
                                [item.id]: {
                                  ...prev[item.id],
                                  basePrice: Number(event.target.value),
                                },
                              }))
                            }
                            className="w-full bg-transparent outline-none"
                          />
                        </label>

                        <label className="flex items-center gap-2 rounded-[var(--radius-control)] border border-[var(--border)] px-3 py-2 text-sm">
                          <span>Stock</span>
                          <input
                            type="number"
                            min={0}
                            value={draft.stockCount ?? ""}
                            onChange={event =>
                              setItemDrafts(prev => ({
                                ...prev,
                                [item.id]: {
                                  ...prev[item.id],
                                  stockCount:
                                    event.target.value === ""
                                      ? null
                                      : Number(event.target.value),
                                },
                              }))
                            }
                            className="w-full bg-transparent outline-none"
                            placeholder="unlimited"
                          />
                        </label>

                        <select
                          value={draft.station}
                          onChange={event =>
                            setItemDrafts(prev => ({
                              ...prev,
                              [item.id]: {
                                ...prev[item.id],
                                station: event.target.value as Station,
                              },
                            }))
                          }
                          className="min-h-[40px] rounded-[var(--radius-control)] border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
                        >
                          <option value="KITCHEN">KITCHEN</option>
                          <option value="BAR">BAR</option>
                        </select>

                        <Button
                          variant={draft.active ? "quiet" : "danger"}
                          className="min-h-[40px]"
                          onClick={() =>
                            setItemDrafts(prev => ({
                              ...prev,
                              [item.id]: {
                                ...prev[item.id],
                                active: !prev[item.id].active,
                              },
                            }))
                          }
                        >
                          {draft.active ? "Visible" : "Hidden"}
                        </Button>

                        <Button
                          className="min-h-[40px]"
                          disabled={busyKey !== null}
                          onClick={() => saveItem(item.id).catch(() => {})}
                        >
                          Save item
                        </Button>
                      </div>
                    </Card>
                  )
                })}
              </div>
            </Card>
          ))}
        </div>
      )}

      {showResetConfirm && (
        <Modal
          title="Reset menu to default"
          onCancel={() => setShowResetConfirm(false)}
          onConfirm={() => resetMenu().catch(() => {})}
          confirmLabel="Reset menu"
          confirmDisabled={busyKey === "menu:reset"}
        >
          This restores all section names and items back to the Fable default seed menu.
        </Modal>
      )}
    </Card>
  )
}
