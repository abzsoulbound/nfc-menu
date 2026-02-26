"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { EditPanel } from "@/components/order/EditPanel"
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
import { calculateCartTotals, calculateItemPrice } from "@/lib/pricing"
import { useRealtimeSync } from "@/lib/useRealtimeSync"
import {
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
  const { items, setScope, addItem, updateItem, removeItem } =
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
  const [editorItem, setEditorItem] = useState<MenuItem | null>(null)
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
                const cartItem = items.find(i => i.id === item.id)
                const quantity = cartItem?.quantity ?? 0
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
                    price={calculateItemPrice(
                      item.basePrice,
                      cartItem?.edits
                    )}
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
                        <QuantitySelector
                          value={quantity}
                          onChange={nextQuantity => {
                            if (nextQuantity === 0) {
                              removeItem(item.id)
                              return
                            }

                            if (cartItem) {
                              updateItem(item.id, {
                                quantity: nextQuantity,
                                unitPrice: calculateItemPrice(
                                  item.basePrice,
                                  cartItem.edits
                                ),
                              })
                              return
                            }

                            addItem({
                              id: item.id,
                              name: item.name,
                              quantity: nextQuantity,
                              edits: null,
                              allergens: item.allergens,
                              unitPrice: item.basePrice,
                              vatRate: item.vatRate,
                              station: item.station,
                            })
                          }}
                        />

                        {item.editableOptions && quantity > 0 && (
                          <Button
                            variant="quiet"
                            onClick={() => setEditorItem(item)}
                            className="min-h-[40px]"
                          >
                            Customize
                          </Button>
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

      {editorItem && (
        <BottomSheet
          title={`Customize ${editorItem.name}`}
          onClose={() => setEditorItem(null)}
        >
          <EditPanel
            item={editorItem}
            value={items.find(i => i.id === editorItem.id)?.edits}
            onChange={edits => {
              updateItem(editorItem.id, {
                edits,
                unitPrice: calculateItemPrice(
                  editorItem.basePrice,
                  edits
                ),
              })
            }}
          />
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
