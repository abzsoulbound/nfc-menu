"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { QuantitySelector } from "@/components/order/QuantitySelector"
import { BottomSheet } from "@/components/ui/BottomSheet"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { Divider } from "@/components/ui/Divider"
import { MenuItemCard } from "@/components/menu/MenuItemCard"
import {
  isCustomerMinimalModeEnabled,
  showCustomerDebugLabels,
} from "@/lib/customerMode"
import { fetchJson } from "@/lib/fetchJson"
import { buildCartLineId, getMenuItemIdFromCartLineId } from "@/lib/cartLine"
import { calculateCartTotals, calculateItemPrice } from "@/lib/pricing"
import { useRealtimeSync } from "@/lib/useRealtimeSync"
import {
  EditSwap,
  EditAddOn,
  ItemEdits,
  MenuSection,
  MenuItem,
  SessionOrderProgressDTO,
  TableDTO,
} from "@/lib/types"
import { useCartStore } from "@/store/useCartStore"
import { useSessionStore } from "@/store/useSessionStore"

type TableState = {
  tableId: string | null
  tableNumber: number | null
  locked: boolean
  stale: boolean
  closed: boolean
}

type CustomerNotification = {
  id: string
  channel: "SMS" | "EMAIL" | "IN_APP"
  recipient: string
  message: string
  createdAt: string
}

type RequiredChoiceGroup = {
  from: string
  options: string[]
}

function buildRequiredChoiceGroups(item: MenuItem): RequiredChoiceGroup[] {
  const grouped = new Map<string, string[]>()
  for (const swap of item.editableOptions?.swaps ?? []) {
    const options = grouped.get(swap.from) ?? [swap.from]
    if (!options.includes(swap.to)) {
      options.push(swap.to)
    }
    grouped.set(swap.from, options)
  }

  return Array.from(grouped.entries()).map(([from, options]) => ({
    from,
    options,
  }))
}

function hasAnyEdits(edits: ItemEdits | null) {
  if (!edits) return false
  if ((edits.removals ?? []).length > 0) return true
  if ((edits.swaps ?? []).length > 0) return true
  if ((edits.addOns ?? []).length > 0) return true
  return false
}

function isTakeaway(tagId: string) {
  return tagId.trim().toLowerCase() === "takeaway"
}

export default function TagOrderingPage({
  params,
}: {
  params: { id: string }
}) {
  const tagId = params.id
  const router = useRouter()
  const takeaway = isTakeaway(tagId)

  const ensureCustomerSession = useSessionStore(
    s => s.ensureCustomerSession
  )
  const { items, setScope, addItem, updateItem } =
    useCartStore()

  const [menuSections, setMenuSections] = useState<MenuSection[]>([])
  const [tableState, setTableState] =
    useState<TableState | null>(null)
  const [sessionReady, setSessionReady] = useState<string | null>(null)
  const [orderProgress, setOrderProgress] = useState<
    SessionOrderProgressDTO[]
  >([])
  const [customerNotifications, setCustomerNotifications] = useState<
    CustomerNotification[]
  >([])
  const [loading, setLoading] = useState(true)
  const [configItem, setConfigItem] = useState<MenuItem | null>(null)
  const [configQuantity, setConfigQuantity] = useState(1)
  const [configSwapSelections, setConfigSwapSelections] = useState<
    Record<string, string>
  >({})
  const [configRemovals, setConfigRemovals] = useState<string[]>([])
  const [configAddOns, setConfigAddOns] = useState<EditAddOn[]>([])
  const [reviewOpen, setReviewOpen] = useState(false)
  const [selectedSectionId, setSelectedSectionId] = useState<
    string | null
  >(null)
  const customerMinimalMode = isCustomerMinimalModeEnabled()
  const showCustomerDebug = showCustomerDebugLabels()

  const refreshTableAndProgress = useCallback(async () => {
    if (!sessionReady) return

    const progressPromise = fetchJson<SessionOrderProgressDTO[]>(
      `/api/orders?view=session&sessionId=${encodeURIComponent(
        sessionReady
      )}`,
      {
        headers: {
          "x-session-id": sessionReady,
        },
        cache: "no-store",
      }
    )
      .then(progress => setOrderProgress(progress))
      .catch(() => {})

    const notificationPromise = fetchJson<CustomerNotification[]>(
      `/api/customer/engagement?view=notifications&recipient=${encodeURIComponent(
        `session:${sessionReady}`
      )}&limit=8`,
      {
        cache: "no-store",
      }
    )
      .then(notifications =>
        setCustomerNotifications(notifications)
      )
      .catch(() => {})

    if (takeaway) {
      await Promise.all([progressPromise, notificationPromise])
      return
    }

    try {
      const tagPayload = await fetchJson<{ tableId: string | null }>(
        "/api/tags",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tagId }),
        }
      )

      if (!tagPayload.tableId) {
        setTableState({
          tableId: null,
          tableNumber: null,
          locked: false,
          stale: false,
          closed: false,
        })
        await Promise.all([progressPromise, notificationPromise])
        return
      }

      const table = await fetchJson<TableDTO>(
        `/api/tables?tableId=${tagPayload.tableId}`,
        {
          cache: "no-store",
        }
      )
      setTableState({
        tableId: table.id,
        tableNumber: table.number,
        locked: table.locked,
        stale: table.stale,
        closed: table.closed,
      })
      await Promise.all([progressPromise, notificationPromise])
    } catch {
      setTableState({
        tableId: null,
        tableNumber: null,
        locked: false,
        stale: false,
        closed: false,
      })
      await Promise.all([progressPromise, notificationPromise])
    }
  }, [sessionReady, takeaway, tagId])

  useEffect(() => {
    let cancelled = false

    async function init() {
      try {
        const sessionId = await ensureCustomerSession(tagId)
        if (!sessionId || cancelled) {
          setLoading(false)
          return
        }
        setSessionReady(sessionId)
        setScope(`customer:${tagId}:${sessionId}`)
        setOrderProgress([])

        const menuPayload = await fetchJson<{
          menu: MenuSection[]
        }>("/api/menu", { cache: "no-store" })

        if (cancelled) return
        setMenuSections(menuPayload.menu)

        if (takeaway) {
          setTableState({
            tableId: null,
            tableNumber: null,
            locked: false,
            stale: false,
            closed: false,
          })
          return
        }

        const tagPayload = await fetchJson<{ tableId: string | null }>(
          "/api/tags",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tagId }),
          }
        )

        if (tagPayload.tableId) {
          const table = await fetchJson<TableDTO>(
            `/api/tables?tableId=${tagPayload.tableId}`,
            {
              cache: "no-store",
            }
          )
          if (cancelled) return
          setTableState({
            tableId: table.id,
            tableNumber: table.number,
            locked: table.locked,
            stale: table.stale,
            closed: table.closed,
          })
        } else {
          setTableState({
            tableId: null,
            tableNumber: null,
            locked: false,
            stale: false,
            closed: false,
          })
        }
      } catch {
        if (!cancelled) {
          setMenuSections([])
          setTableState({
            tableId: null,
            tableNumber: null,
            locked: false,
            stale: false,
            closed: false,
          })
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    init()
    return () => {
      cancelled = true
    }
  }, [tagId, takeaway, ensureCustomerSession, setScope])

  useEffect(() => {
    if (!sessionReady) return
    refreshTableAndProgress().catch(() => {})
    const timer = setInterval(() => {
      refreshTableAndProgress().catch(() => {})
    }, 5000)
    return () => clearInterval(timer)
  }, [sessionReady, refreshTableAndProgress])

  useRealtimeSync(() => {
    refreshTableAndProgress().catch(() => {})
  })

  const viewOnly = useMemo(() => {
    return !!(
      tableState?.locked ||
      tableState?.stale ||
      tableState?.closed
    )
  }, [tableState])

  const totals = useMemo(() => {
    return calculateCartTotals(
      items.map(item => ({
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        vatRate: item.vatRate,
      }))
    )
  }, [items])

  const totalQuantity = useMemo(() => {
    return items.reduce((sum, item) => sum + item.quantity, 0)
  }, [items])

  const progressSummary = useMemo(() => {
    return orderProgress.reduce(
      (acc, order) => {
        acc.total += order.totalItems
        acc.submitted += order.states.submitted
        acc.prepping += order.states.prepping
        acc.ready += order.states.ready
        acc.delivered += order.states.delivered
        return acc
      },
      {
        total: 0,
        submitted: 0,
        prepping: 0,
        ready: 0,
        delivered: 0,
      }
    )
  }, [orderProgress])

  useEffect(() => {
    if (menuSections.length === 0) {
      setSelectedSectionId(null)
      return
    }
    setSelectedSectionId(prev => {
      if (
        prev &&
        menuSections.some(section => section.id === prev)
      ) {
        return prev
      }
      return menuSections[0].id
    })
  }, [menuSections])

  const selectedSection = useMemo(() => {
    if (menuSections.length === 0) return null
    return (
      menuSections.find(section => section.id === selectedSectionId) ??
      menuSections[0]
    )
  }, [menuSections, selectedSectionId])

  const quantityByMenuItemId = useMemo(() => {
    const map = new Map<string, number>()
    for (const line of items) {
      const menuItemId = getMenuItemIdFromCartLineId(line.id)
      map.set(menuItemId, (map.get(menuItemId) ?? 0) + line.quantity)
    }
    return map
  }, [items])

  const requiredChoiceGroups = useMemo(
    () => (configItem ? buildRequiredChoiceGroups(configItem) : []),
    [configItem]
  )

  const missingRequiredCount = useMemo(() => {
    return requiredChoiceGroups.filter(group => {
      const selected = configSwapSelections[group.from]
      return !selected
    }).length
  }, [requiredChoiceGroups, configSwapSelections])

  const configEdits = useMemo<ItemEdits | null>(() => {
    if (!configItem) return null

    const swaps: EditSwap[] = []
    for (const group of requiredChoiceGroups) {
      const selected = configSwapSelections[group.from]
      if (!selected || selected === group.from) continue
      swaps.push({
        from: group.from,
        to: selected,
      })
    }

    const edits: ItemEdits = {
      removals: configRemovals.length > 0 ? [...configRemovals] : undefined,
      swaps: swaps.length > 0 ? swaps : undefined,
      addOns: configAddOns.length > 0 ? [...configAddOns] : undefined,
    }

    return hasAnyEdits(edits) ? edits : null
  }, [
    configItem,
    requiredChoiceGroups,
    configSwapSelections,
    configRemovals,
    configAddOns,
  ])

  const configUnitPrice = useMemo(() => {
    if (!configItem) return 0
    return calculateItemPrice(configItem.basePrice, configEdits)
  }, [configItem, configEdits])

  function openConfigurator(item: MenuItem) {
    const groups = buildRequiredChoiceGroups(item)
    const initialSelections: Record<string, string> = {}
    for (const group of groups) {
      initialSelections[group.from] = ""
    }

    setConfigItem(item)
    setConfigQuantity(1)
    setConfigSwapSelections(initialSelections)
    setConfigRemovals([])
    setConfigAddOns([])
  }

  function addConfiguredItemToBasket() {
    if (!configItem || viewOnly) return
    if (missingRequiredCount > 0) return

    const lineId = buildCartLineId(configItem.id, configEdits)
    const existingLine = items.find(line => line.id === lineId)
    const unitPrice = calculateItemPrice(configItem.basePrice, configEdits)

    if (existingLine) {
      updateItem(lineId, {
        quantity: existingLine.quantity + configQuantity,
        unitPrice,
        edits: configEdits,
      })
    } else {
      addItem({
        id: lineId,
        name: configItem.name,
        quantity: configQuantity,
        edits: configEdits,
        allergens: configItem.allergens,
        unitPrice,
        vatRate: configItem.vatRate,
        station: configItem.station,
      })
    }

    setConfigItem(null)
    setConfigQuantity(1)
    setConfigSwapSelections({})
    setConfigRemovals([])
    setConfigAddOns([])
  }

  if (loading) {
    return (
      <div className="p-4 text-center text-sm text-secondary">
        Loading menu...
      </div>
    )
  }

  return (
    <div className="relative px-4 py-4 md:px-6 md:py-6">
      <div className="mx-auto max-w-[1120px] space-y-4">
        {menuSections.length > 0 && (
          <div className="rounded-2xl border border-[var(--border)] surface-secondary p-3">
            <div className="flex flex-wrap gap-2">
              {menuSections.map(section => {
                const active = section.id === selectedSection?.id
                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => setSelectedSectionId(section.id)}
                    className={`focus-ring rounded-full border px-3 py-1.5 text-xs font-semibold transition-all duration-150 ${
                      active
                        ? "border-transparent bg-[var(--accent-action)] text-white"
                        : "border-[var(--border)] bg-transparent text-[var(--text-primary)]"
                    }`}
                  >
                    {section.name}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {viewOnly && (
          <Card variant="accent">
            <div className="text-sm text-secondary">
              This menu is unavailable right now. Please ask a staff member.
            </div>
          </Card>
        )}

        {showCustomerDebug && orderProgress.length > 0 && (
          <Card variant="accent">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-base font-semibold tracking-tight">
                  Live Order Status
                </h3>
                <span className="status-chip status-chip-neutral">
                  {progressSummary.total} item(s)
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                <div className="rounded-[var(--radius-control)] border border-[var(--border)] surface-secondary px-3 py-2 text-sm">
                  Submitted: {progressSummary.submitted}
                </div>
                <div className="rounded-[var(--radius-control)] border border-[var(--border)] surface-secondary px-3 py-2 text-sm">
                  Prepping: {progressSummary.prepping}
                </div>
                <div className="rounded-[var(--radius-control)] border border-[var(--border)] surface-secondary px-3 py-2 text-sm">
                  Ready: {progressSummary.ready}
                </div>
                <div className="rounded-[var(--radius-control)] border border-[var(--border)] surface-secondary px-3 py-2 text-sm">
                  Delivered: {progressSummary.delivered}
                </div>
              </div>

              <div className="space-y-1">
                {orderProgress.slice(0, 3).map(order => (
                  <div
                    key={order.orderId}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-control)] border border-[var(--border)] surface-secondary px-3 py-2 text-xs text-secondary"
                  >
                    <span className="mono-font">{order.orderId.slice(0, 8)}</span>
                    <span>
                      S {order.states.submitted} | P {order.states.prepping} | R{" "}
                      {order.states.ready} | D {order.states.delivered}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        )}

        {showCustomerDebug && customerNotifications.length > 0 && (
          <Card variant="accent">
            <div className="space-y-2">
              <h3 className="text-base font-semibold tracking-tight">
                Updates
              </h3>
              {customerNotifications.map(notification => (
                <div
                  key={notification.id}
                  className="rounded-[var(--radius-control)] border border-[var(--border)] surface-secondary px-3 py-2 text-sm text-secondary"
                >
                  {notification.message}
                </div>
              ))}
            </div>
          </Card>
        )}

        {selectedSection && (
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="display-font text-3xl tracking-tight">
                {selectedSection.name}
              </h2>
              {!customerMinimalMode && (
                <span className="status-chip status-chip-neutral">
                  {selectedSection.items.length} items
                </span>
              )}
            </div>

            <div className="space-y-3">
              {selectedSection.items.map(item => {
                const quantity = quantityByMenuItemId.get(item.id) ?? 0
                const itemUnavailable =
                  item.active === false ||
                  (typeof item.stockCount === "number" &&
                    item.stockCount <= 0)

                return (
                  <MenuItemCard
                    key={item.id}
                    name={item.name}
                    description={item.description}
                    image={item.image}
                    price={item.basePrice}
                    vatRate={item.vatRate}
                    allergens={item.allergens}
                    station={item.station}
                    editableOptions={item.editableOptions}
                    variant="order"
                    readOnly={viewOnly || itemUnavailable}
                  >
                    {itemUnavailable ? (
                      <div className="status-chip status-chip-danger inline-flex">
                        Unavailable
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Button
                          variant="primary"
                          className="min-h-[40px]"
                          onClick={() => openConfigurator(item)}
                        >
                          {item.editableOptions ? "Select options" : "Add item"}
                        </Button>

                        {quantity > 0 && (
                          <span className="status-chip status-chip-neutral">
                            In basket: {quantity}
                          </span>
                        )}
                      </div>
                    )}
                  </MenuItemCard>
                )
              })}
            </div>
          </section>
        )}

        {menuSections.length === 0 && (
          <Card>
            <div className="text-center text-sm text-secondary">
              Unavailable.
            </div>
          </Card>
        )}
      </div>

      {!viewOnly && totalQuantity > 0 && sessionReady && (
        <button
          type="button"
          onClick={() => setReviewOpen(true)}
          className="focus-ring fixed bottom-5 right-4 z-40 flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-left shadow-[var(--shadow-hard)] md:right-8"
        >
          <span className="inline-flex min-h-[30px] min-w-[30px] items-center justify-center rounded-full bg-[var(--accent-action)] px-2 text-sm font-semibold text-white">
            {totalQuantity}
          </span>
          <span className="leading-tight">
            <span className="block text-sm font-semibold">
              £{totals.total.toFixed(2)} | Review
            </span>
          </span>
        </button>
      )}

      {configItem && (
        <BottomSheet
          title={`Configure ${configItem.name}`}
          onClose={() => setConfigItem(null)}
          primaryAction={{
            label: "Add to basket",
            onClick: addConfiguredItemToBasket,
            disabled: missingRequiredCount > 0 || configQuantity < 1,
          }}
        >
          <div className="space-y-3">
            {requiredChoiceGroups.length > 0 && (
              <Card variant="accent">
                <div className="space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
                    Required picks
                  </div>
                  {requiredChoiceGroups.map(group => (
                    <label
                      key={group.from}
                      className="flex items-center gap-2"
                    >
                      <span className="min-w-[120px] text-sm text-secondary">
                        Choose {group.from}
                      </span>
                      <select
                        className="w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-transparent px-2 py-1.5 text-sm"
                        value={configSwapSelections[group.from] ?? ""}
                        onChange={event =>
                          setConfigSwapSelections(prev => ({
                            ...prev,
                            [group.from]: event.target.value,
                          }))
                        }
                      >
                        <option value="">Select...</option>
                        {group.options.map(option => (
                          <option key={`${group.from}-${option}`} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              </Card>
            )}

            {(configItem.editableOptions?.removals ?? []).length > 0 && (
              <Card variant="accent">
                <div className="space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
                    Optional removals
                  </div>
                  {(configItem.editableOptions?.removals ?? []).map(removal => (
                    <label
                      key={removal}
                      className="flex items-center gap-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={configRemovals.includes(removal)}
                        onChange={event => {
                          setConfigRemovals(prev =>
                            event.target.checked
                              ? [...prev, removal]
                              : prev.filter(value => value !== removal)
                          )
                        }}
                      />
                      Remove {removal}
                    </label>
                  ))}
                </div>
              </Card>
            )}

            {(configItem.editableOptions?.addOns ?? []).length > 0 && (
              <Card variant="accent">
                <div className="space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
                    Optional add-ons
                  </div>
                  {(configItem.editableOptions?.addOns ?? []).map(addOn => {
                    const checked = configAddOns.some(
                      selected => selected.name === addOn.name
                    )
                    return (
                      <label
                        key={addOn.name}
                        className="flex items-center gap-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={event => {
                            setConfigAddOns(prev =>
                              event.target.checked
                                ? [...prev, addOn]
                                : prev.filter(item => item.name !== addOn.name)
                            )
                          }}
                        />
                        {addOn.name} (+£{addOn.priceDelta.toFixed(2)})
                      </label>
                    )
                  })}
                </div>
              </Card>
            )}

            <Card variant="accent">
              <div className="space-y-3">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
                  Quantity
                </div>
                <QuantitySelector
                  min={1}
                  value={configQuantity}
                  onChange={setConfigQuantity}
                />
                <div className="text-sm text-secondary">
                  Line total: £{(configUnitPrice * configQuantity).toFixed(2)}
                </div>
                {missingRequiredCount > 0 && (
                  <div className="status-chip status-chip-warning inline-flex">
                    Choose all required picks to continue
                  </div>
                )}
              </div>
            </Card>
          </div>
        </BottomSheet>
      )}

      {reviewOpen && (
        <BottomSheet
          title="Review Order"
          onClose={() => setReviewOpen(false)}
          primaryAction={{
            label: "Review",
            onClick: () => router.push(`/order/review/${tagId}`),
          }}
        >
          <div className="space-y-3">
            {items.map(item => (
              <Card key={item.id} variant="accent">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold">
                      {item.quantity} x {item.name}
                    </div>
                    {item.edits && (
                      <div className="text-xs text-muted">Modified</div>
                    )}
                  </div>
                  <div className="text-sm font-semibold">
                    £{(item.quantity * item.unitPrice).toFixed(2)}
                  </div>
                </div>
              </Card>
            ))}

            <Divider />

            <Card>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between font-semibold">
                  <span>Total</span>
                  <span>£{totals.total.toFixed(2)}</span>
                </div>
              </div>
            </Card>
          </div>
        </BottomSheet>
      )}
    </div>
  )
}
