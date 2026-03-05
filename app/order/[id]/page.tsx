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
import { trackUxFunnelEventClient } from "@/lib/uxClient"
import {
  buildCartLineId,
  getMenuItemIdFromCartLineId,
} from "@/lib/cartLine"
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
import { useOrderMenuUiStore } from "@/store/useOrderMenuUiStore"
import { useRestaurantStore } from "@/store/useRestaurantStore"
import { useSessionStore } from "@/store/useSessionStore"
import { useUxFunnelTracking } from "@/lib/useUxFunnelTracking"

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
  key: string
  from: string
  options: string[]
  includeFromByDefault: boolean
}

function buildRequiredChoiceGroups(item: MenuItem): RequiredChoiceGroup[] {
  const grouped = new Map<string, RequiredChoiceGroup>()
  for (const swap of item.editableOptions?.swaps ?? []) {
    const rawFrom = swap.from.trim()
    const isExplicitChoice = rawFrom
      .toLowerCase()
      .startsWith("choice:")
    const from = isExplicitChoice
      ? rawFrom.slice("choice:".length).trim()
      : rawFrom
    const group =
      grouped.get(rawFrom) ??
      {
        key: rawFrom,
        from,
        options: isExplicitChoice ? [] : [from],
        includeFromByDefault: !isExplicitChoice,
      }

    if (!group.options.includes(swap.to)) {
      group.options.push(swap.to)
    }
    grouped.set(rawFrom, group)
  }

  return Array.from(grouped.values())
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

function formatCurrency(value: number) {
  return `£${value.toFixed(2)}`
}

function hasEditableOptions(item: MenuItem) {
  return Boolean(
    item.editableOptions &&
      (
        (item.editableOptions.swaps ?? []).length > 0 ||
        (item.editableOptions.removals ?? []).length > 0 ||
        (item.editableOptions.addOns ?? []).length > 0
      )
  )
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
  const {
    items,
    setScope,
    addItem,
    updateItem,
    removeItem,
  } = useCartStore()
  const reviewOpen = useOrderMenuUiStore(s => s.reviewOpen)
  const openReview = useOrderMenuUiStore(s => s.openReview)
  const closeReview = useOrderMenuUiStore(s => s.closeReview)
  const setCanOpenReview = useOrderMenuUiStore(
    s => s.setCanOpenReview
  )
  const resetOrderMenuUi = useOrderMenuUiStore(s => s.reset)

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
  const [editingLineId, setEditingLineId] = useState<string | null>(
    null
  )
  const [selectedSectionId, setSelectedSectionId] = useState<
    string | null
  >(null)
  const [sectionSearch, setSectionSearch] = useState("")
  const customerMinimalMode = isCustomerMinimalModeEnabled()
  const showCustomerDebug = showCustomerDebugLabels()
  const reviewConfig = useRestaurantStore(
    s => s.experienceConfig.review
  )
  const uxConfig = useRestaurantStore(s => s.experienceConfig.ux)
  const uxTracking = useUxFunnelTracking({
    page: "order",
    step: "select",
  })

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
        headers: {
          "x-session-id": sessionReady,
        },
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
  }, sessionReady)

  const viewOnly = useMemo(() => {
    return !!(
      tableState?.locked ||
      tableState?.stale ||
      tableState?.closed
    )
  }, [tableState])

  useEffect(() => {
    setCanOpenReview(Boolean(sessionReady) && !viewOnly)
  }, [sessionReady, viewOnly, setCanOpenReview])

  useEffect(() => {
    return () => {
      resetOrderMenuUi()
    }
  }, [tagId, resetOrderMenuUi])

  const totals = useMemo(() => {
    return calculateCartTotals(
      items.map(item => ({
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        vatRate: item.vatRate,
      }))
    )
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

  useEffect(() => {
    setSectionSearch("")
  }, [selectedSectionId])

  const normalizedSectionSearch = sectionSearch.trim().toLowerCase()
  const filteredSectionItems = useMemo(() => {
    if (!selectedSection) return []
    if (!normalizedSectionSearch) return selectedSection.items

    return selectedSection.items.filter(item => {
      const haystack = [
        item.name,
        item.description,
        item.station,
        ...(item.allergens ?? []),
      ]
        .join(" ")
        .toLowerCase()
      return haystack.includes(normalizedSectionSearch)
    })
  }, [normalizedSectionSearch, selectedSection])

  const basketCount = useMemo(() => {
    return items.reduce((sum, item) => sum + item.quantity, 0)
  }, [items])
  const serviceContextLabel = takeaway
    ? "Takeaway"
    : tableState?.tableNumber
      ? `Table ${tableState.tableNumber}`
      : "Table session"
  const serviceStatusLabel = viewOnly
    ? "Ordering paused"
    : "Ordering open"
  const strictOrderSafety = uxConfig.orderSafetyMode === "STRICT"
  const orderingHelpText =
    uxConfig.ordering === "INLINE_STEPPER"
      ? "Use quick add for simple items, customize only when needed."
      : uxConfig.ordering === "GUIDED_CONFIGURATOR"
        ? "Open guided customization for each item before adding."
        : "Choose your section, customize items, then review before placing."

  const menuItemsById = useMemo(() => {
    const map = new Map<string, MenuItem>()
    for (const section of menuSections) {
      for (const item of section.items) {
        map.set(item.id, item)
      }
    }
    return map
  }, [menuSections])

  const requiredChoiceGroups = useMemo(
    () => (configItem ? buildRequiredChoiceGroups(configItem) : []),
    [configItem]
  )

  const missingRequiredCount = useMemo(() => {
    return requiredChoiceGroups.filter(group => {
      const selected = configSwapSelections[group.key]
      return !selected
    }).length
  }, [requiredChoiceGroups, configSwapSelections])

  const configEdits = useMemo<ItemEdits | null>(() => {
    if (!configItem) return null

    const swaps: EditSwap[] = []
    for (const group of requiredChoiceGroups) {
      const selected = configSwapSelections[group.key]
      if (!selected) continue
      if (group.includeFromByDefault && selected === group.from) continue
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
      initialSelections[group.key] = ""
    }

    setConfigItem(item)
    setEditingLineId(null)
    setConfigQuantity(1)
    setConfigSwapSelections(initialSelections)
    setConfigRemovals([])
    setConfigAddOns([])
  }

  function addItemQuickly(item: MenuItem) {
    if (viewOnly) return

    const lineId = buildCartLineId(item.id, null)
    const existing = items.find(line => line.id === lineId)
    if (existing) {
      updateItem(lineId, {
        quantity: existing.quantity + 1,
      })
      return
    }

    addItem({
      id: lineId,
      name: item.name,
      quantity: 1,
      edits: null,
      allergens: item.allergens,
      unitPrice: calculateItemPrice(item.basePrice, null),
      vatRate: item.vatRate,
      station: item.station,
    })

    void trackUxFunnelEventClient({
      sessionId: uxTracking.sessionId || `order-${tagId}`,
      eventName: "item_add",
      page: "order",
      step: "select",
      experimentKey: uxTracking.experimentKey ?? undefined,
      variantKey: uxTracking.variantKey ?? undefined,
      metadata: {
        source: "quick_add",
        itemId: item.id,
      },
    })
  }

  function openReviewExperience() {
    if (uxConfig.review === "PAGE_REVIEW") {
      void trackUxFunnelEventClient({
        sessionId: uxTracking.sessionId || `order-${tagId}`,
        eventName: "open_review",
        page: "order",
        step: "review_transition",
        experimentKey: uxTracking.experimentKey ?? undefined,
        variantKey: uxTracking.variantKey ?? undefined,
        metadata: {
          mode: "page",
        },
      })
      router.push(`/order/review/${tagId}`)
      return
    }
    void trackUxFunnelEventClient({
      sessionId: uxTracking.sessionId || `order-${tagId}`,
      eventName: "open_review",
      page: "order",
      step: "review_transition",
      experimentKey: uxTracking.experimentKey ?? undefined,
      variantKey: uxTracking.variantKey ?? undefined,
      metadata: {
        mode: "sheet",
      },
    })
    openReview()
  }

  function openConfiguratorFromReviewLine(lineId: string) {
    const line = items.find(item => item.id === lineId)
    if (!line) return

    const menuItemId = getMenuItemIdFromCartLineId(line.id)
    const menuItem = menuItemsById.get(menuItemId)
    if (!menuItem) return

    const groups = buildRequiredChoiceGroups(menuItem)
    const existingSwaps = line.edits?.swaps ?? []
    const initialSelections: Record<string, string> = {}

    for (const group of groups) {
      const selectedSwap = existingSwaps.find(
        swap =>
          swap.from.trim().toLowerCase() ===
          group.from.trim().toLowerCase()
      )
      if (selectedSwap) {
        initialSelections[group.key] = selectedSwap.to
        continue
      }
      initialSelections[group.key] = group.includeFromByDefault
        ? group.from
        : ""
    }

    closeReview()
    setConfigItem(menuItem)
    setEditingLineId(line.id)
    setConfigQuantity(line.quantity)
    setConfigSwapSelections(initialSelections)
    setConfigRemovals([...(line.edits?.removals ?? [])])
    setConfigAddOns([...(line.edits?.addOns ?? [])])
  }

  function resetConfiguratorState() {
    setConfigItem(null)
    setEditingLineId(null)
    setConfigQuantity(1)
    setConfigSwapSelections({})
    setConfigRemovals([])
    setConfigAddOns([])
  }

  function addConfiguredItemToBasket() {
    if (!configItem || viewOnly) return
    if (missingRequiredCount > 0) return

    const targetLineId = buildCartLineId(configItem.id, configEdits)
    const existingLine = items.find(line => line.id === targetLineId)
    const unitPrice = calculateItemPrice(configItem.basePrice, configEdits)

    if (editingLineId) {
      if (targetLineId === editingLineId) {
        updateItem(editingLineId, {
          quantity: configQuantity,
          unitPrice,
          edits: configEdits,
        })
      } else {
        removeItem(editingLineId)
        if (existingLine) {
          updateItem(targetLineId, {
            quantity: existingLine.quantity + configQuantity,
            unitPrice,
            edits: configEdits,
          })
        } else {
          addItem({
            id: targetLineId,
            name: configItem.name,
            quantity: configQuantity,
            edits: configEdits,
            allergens: configItem.allergens,
            unitPrice,
            vatRate: configItem.vatRate,
            station: configItem.station,
          })
        }
      }
      resetConfiguratorState()
      return
    }

    if (existingLine) {
      updateItem(targetLineId, {
        quantity: existingLine.quantity + configQuantity,
        unitPrice,
        edits: configEdits,
      })
    } else {
      addItem({
        id: targetLineId,
        name: configItem.name,
        quantity: configQuantity,
        edits: configEdits,
        allergens: configItem.allergens,
        unitPrice,
        vatRate: configItem.vatRate,
        station: configItem.station,
      })
    }

    void trackUxFunnelEventClient({
      sessionId: uxTracking.sessionId || `order-${tagId}`,
      eventName: "item_add",
      page: "order",
      step: "configure",
      experimentKey: uxTracking.experimentKey ?? undefined,
      variantKey: uxTracking.variantKey ?? undefined,
      metadata: {
        source: editingLineId ? "edit_existing" : "configurator",
        itemId: configItem.id,
        quantity: configQuantity,
      },
    })

    resetConfiguratorState()
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
      <div
        aria-hidden="true"
        className="menu-orbit pointer-events-none absolute -left-16 top-14 h-44 w-44 rounded-full bg-[radial-gradient(circle,rgba(201,169,110,0.22),rgba(201,169,110,0))] blur-3xl"
      />
      <div
        aria-hidden="true"
        className="menu-orbit pointer-events-none absolute -right-12 top-48 h-48 w-48 rounded-full bg-[radial-gradient(circle,rgba(110,154,221,0.22),rgba(110,154,221,0))] blur-3xl [animation-delay:240ms]"
      />

      <div className="mx-auto max-w-[1120px] space-y-4 pb-24">
        <Card
          variant="elevated"
          className="menu-reveal border-[rgba(201,169,110,0.36)] bg-[linear-gradient(136deg,rgba(255,252,245,0.96),rgba(245,232,206,0.92))]"
        >
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <div className="space-y-2">
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted">
                {serviceContextLabel}
              </div>
              <h1 className="display-font text-4xl leading-tight tracking-tight">
                Build your order
              </h1>
              <p className="text-sm leading-6 text-secondary">
                {orderingHelpText}
              </p>
            </div>

            <div className="rounded-xl border border-[var(--border)] bg-[rgba(255,255,255,0.62)] px-4 py-3 text-right">
              <div className="text-[10px] uppercase tracking-[0.16em] text-muted">
                Basket
              </div>
              <div className="display-font mt-1 text-3xl leading-none">
                {formatCurrency(totals.total)}
              </div>
              <div className="mt-1 text-xs text-secondary">
                {basketCount} item{basketCount === 1 ? "" : "s"} selected
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span
              className={`status-chip ${
                viewOnly ? "status-chip-danger" : "status-chip-success"
              }`}
            >
              {serviceStatusLabel}
            </span>
            <span className="status-chip status-chip-neutral">
              {uxConfig.ordering === "INLINE_STEPPER"
                ? "Quick add mode"
                : uxConfig.ordering === "GUIDED_CONFIGURATOR"
                  ? "Guided customization"
                  : "Fast configure mode"}
            </span>
            <span className="status-chip status-chip-neutral">
              {uxConfig.review === "PAGE_REVIEW"
                ? "Full review page"
                : "Quick review sheet"}
            </span>
            <span
              className={`status-chip ${
                strictOrderSafety
                  ? "status-chip-warning"
                  : "status-chip-neutral"
              }`}
            >
              {strictOrderSafety
                ? "Strict order safety checks"
                : "Standard order safety checks"}
            </span>
            {orderProgress.length > 0 && (
              <>
                <span className="status-chip status-chip-neutral">
                  Submitted {progressSummary.submitted}
                </span>
                <span className="status-chip status-chip-warning">
                  Ready {progressSummary.ready}
                </span>
              </>
            )}
          </div>

          {strictOrderSafety && (
            <div className="mt-3 rounded-xl border border-[var(--border)] bg-[rgba(255,255,255,0.58)] px-3 py-2 text-xs text-secondary">
              Double-check item choices before reviewing. Need help? Ask a
              staff member at your table.
            </div>
          )}
        </Card>

        {menuSections.length > 0 && (
          <div className="menu-reveal menu-delay-1 rounded-2xl border border-[var(--border)] bg-[linear-gradient(160deg,rgba(255,251,242,0.96),rgba(246,234,212,0.92))] p-3">
            {uxConfig.showProgressAnchors && (
              <div className="mb-2 flex flex-wrap gap-2">
                <span className="status-chip status-chip-neutral inline-flex">
                  1. Select section
                </span>
                <span className="status-chip status-chip-neutral inline-flex">
                  2. Add items
                </span>
                <span className="status-chip status-chip-neutral inline-flex">
                  3. Review & submit
                </span>
              </div>
            )}

            <div className="flex gap-2 overflow-x-auto pb-2">
              {menuSections.map(section => {
                const active = section.id === selectedSection?.id
                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => setSelectedSectionId(section.id)}
                    className={`focus-ring shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition-all duration-150 ${
                      active
                        ? "border-transparent bg-[var(--accent-action)] text-white shadow-[var(--shadow-soft)]"
                        : "border-[var(--border)] bg-[rgba(255,255,255,0.58)] text-[var(--text-primary)]"
                    }`}
                  >
                    {section.name}
                  </button>
                )
              })}
            </div>

            {selectedSection && (
              <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                <label className="space-y-1 text-xs uppercase tracking-[0.12em] text-muted">
                  Search this section
                  <input
                    type="text"
                    value={sectionSearch}
                    onChange={event =>
                      setSectionSearch(event.target.value)
                    }
                    placeholder="Search dishes, drinks, or allergens"
                    className="w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[rgba(255,255,255,0.72)] px-3 py-2 text-sm text-[var(--text-primary)]"
                  />
                </label>
                <div className="status-chip status-chip-neutral inline-flex">
                  {filteredSectionItems.length} of{" "}
                  {selectedSection.items.length} shown
                </div>
              </div>
            )}
          </div>
        )}

        {viewOnly && (
          <Card variant="accent">
            <div className="text-sm text-secondary">
              This menu is unavailable right now. Please ask a staff member.
            </div>
          </Card>
        )}

        {orderProgress.length > 0 && (
          <Card variant="accent" className="menu-reveal menu-delay-1">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-base font-semibold tracking-tight">
                  Live order status
                </h3>
                <span className="status-chip status-chip-neutral">
                  {progressSummary.total} item(s) in service
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
          <section className="menu-reveal menu-delay-1 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="display-font text-3xl tracking-tight">
                {selectedSection.name}
              </h2>
              {!customerMinimalMode && (
                <span className="status-chip status-chip-neutral">
                  {filteredSectionItems.length} items
                </span>
              )}
            </div>

            <div className="space-y-3">
              {filteredSectionItems.length === 0 && (
                <Card>
                  <div className="text-center text-sm text-secondary">
                    No items match this search yet.
                  </div>
                </Card>
              )}

              {filteredSectionItems.map(item => {
                const itemUnavailable =
                  item.active === false ||
                  (typeof item.stockCount === "number" &&
                    item.stockCount <= 0)
                const canQuickAdd =
                  uxConfig.ordering === "INLINE_STEPPER" &&
                  !hasEditableOptions(item)
                const quickLineId = buildCartLineId(item.id, null)
                const quickLineQuantity =
                  items.find(line => line.id === quickLineId)
                    ?.quantity ?? 0

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
                    actionPlacement="underPrice"
                    readOnly={viewOnly || itemUnavailable}
                  >
                    {itemUnavailable ? (
                      <div className="status-chip status-chip-danger inline-flex">
                        Unavailable
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          variant="primary"
                          className="min-h-[40px] w-full sm:w-auto"
                          onClick={() => {
                            if (canQuickAdd) {
                              addItemQuickly(item)
                              return
                            }
                            openConfigurator(item)
                          }}
                        >
                          {canQuickAdd
                            ? "Add +1"
                            : uxConfig.ordering ===
                                "GUIDED_CONFIGURATOR"
                              ? "Customize"
                              : "Add item"}
                        </Button>
                        {canQuickAdd && quickLineQuantity > 0 && (
                          <span className="status-chip status-chip-neutral inline-flex">
                            In basket: {quickLineQuantity}
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

      {!viewOnly && basketCount > 0 && (
        <div className="fixed inset-x-0 bottom-4 z-30 px-4 md:px-6">
          <div className="mx-auto max-w-[1120px]">
            <div className="rounded-2xl border border-[rgba(201,169,110,0.45)] bg-[rgba(13,26,47,0.92)] px-3 py-3 shadow-[var(--shadow-hard)] backdrop-blur">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-[13px] text-[rgba(238,227,207,0.92)]">
                  <span className="font-semibold">
                    {basketCount} item{basketCount === 1 ? "" : "s"}
                  </span>{" "}
                  in basket |{" "}
                  <span className="font-semibold">
                    {formatCurrency(totals.total)}
                  </span>
                </div>
                <Button
                  variant="primary"
                  className="min-h-[42px]"
                  onClick={openReviewExperience}
                >
                  {uxConfig.review === "PAGE_REVIEW"
                    ? "Open review page"
                    : "Review basket"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {configItem && (
        <BottomSheet
          title={`Configure ${configItem.name}`}
          onClose={resetConfiguratorState}
          primaryAction={{
            label: editingLineId ? "Save changes" : "Add to basket",
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
                      key={group.key}
                      className="flex items-center gap-2"
                    >
                      <span className="min-w-[120px] text-sm text-secondary">
                        Choose {group.from}
                      </span>
                      <select
                        className="w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-transparent px-2 py-1.5 text-sm"
                        value={configSwapSelections[group.key] ?? ""}
                        onChange={event =>
                          setConfigSwapSelections(prev => ({
                            ...prev,
                            [group.key]: event.target.value,
                          }))
                        }
                      >
                        <option value="">Select...</option>
                        {group.options.map(option => (
                          <option key={`${group.key}-${option}`} value={option}>
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

      {uxConfig.review === "SHEET_REVIEW" && reviewOpen && (
        <BottomSheet
          title={reviewConfig.title}
          onClose={closeReview}
          primaryAction={{
            label: reviewConfig.title,
            onClick: () => router.push(`/order/review/${tagId}`),
          }}
        >
          <div className="space-y-3">
            {items.map(item => {
              const menuItemId = getMenuItemIdFromCartLineId(item.id)
              const menuItem = menuItemsById.get(menuItemId)
              const hasEditableOptions = Boolean(
                menuItem &&
                  (
                    (menuItem.editableOptions?.swaps ?? []).length > 0 ||
                    (menuItem.editableOptions?.removals ?? []).length > 0 ||
                    (menuItem.editableOptions?.addOns ?? []).length > 0
                  )
              )

              return (
                <Card key={item.id} variant="accent">
                  <div className="space-y-2">
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
                    <div className="flex items-center justify-between gap-2">
                      <QuantitySelector
                        min={0}
                        value={item.quantity}
                        onChange={next => {
                          if (next <= 0) {
                            removeItem(item.id)
                            return
                          }
                          updateItem(item.id, { quantity: next })
                        }}
                      />
                      {hasEditableOptions && (
                        <Button
                          variant="secondary"
                          className="min-h-[40px] px-3 text-xs"
                          onClick={() =>
                            openConfiguratorFromReviewLine(item.id)
                          }
                        >
                          Edit options
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              )
            })}

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
