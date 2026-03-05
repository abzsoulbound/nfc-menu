"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { fetchJson } from "@/lib/fetchJson"
import {
  CustomerCheckoutReceiptDTO,
  DeliveryChannelOrderDTO,
  FeedbackDTO,
  FeatureSummaryDTO,
  LoyaltyAccountDTO,
  MenuDaypartDTO,
  PromoCodeDTO,
  ReservationDTO,
  WaitlistEntryDTO,
} from "@/lib/types"

type InventoryAlertsPayload = {
  threshold: number
  alerts: {
    sectionId: string
    sectionName: string
    itemId: string
    itemName: string
    stockCount: number
    threshold: number
  }[]
}

type NotificationDTO = {
  id: string
  channel: "SMS" | "EMAIL" | "IN_APP"
  recipient: string
  message: string
  relatedType: string
  relatedId: string
  createdAt: string
}

const controlFieldClass =
  "rounded-[var(--radius-control)] border border-[rgba(120,161,234,0.34)] bg-[rgba(20,34,58,0.52)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[rgba(138,180,255,0.72)]"

function fmt(value: number) {
  return `£${value.toFixed(2)}`
}

export default function ManagerFeaturePage() {
  const [summary, setSummary] = useState<FeatureSummaryDTO | null>(null)
  const [promos, setPromos] = useState<PromoCodeDTO[]>([])
  const [reservations, setReservations] = useState<ReservationDTO[]>([])
  const [waitlist, setWaitlist] = useState<WaitlistEntryDTO[]>([])
  const [loyalty, setLoyalty] = useState<LoyaltyAccountDTO[]>([])
  const [delivery, setDelivery] = useState<DeliveryChannelOrderDTO[]>([])
  const [dayparts, setDayparts] = useState<MenuDaypartDTO[]>([])
  const [inventory, setInventory] = useState<InventoryAlertsPayload | null>(null)
  const [feedback, setFeedback] = useState<FeedbackDTO[]>([])
  const [notifications, setNotifications] = useState<NotificationDTO[]>([])
  const [receipts, setReceipts] = useState<CustomerCheckoutReceiptDTO[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null)

  const [promoCode, setPromoCode] = useState("WEEKDAY15")
  const [promoDescription, setPromoDescription] = useState("15% off selected windows")
  const [promoKind, setPromoKind] = useState<"PERCENT" | "FIXED">("PERCENT")
  const [promoValue, setPromoValue] = useState("15")
  const [promoMinSpend, setPromoMinSpend] = useState("25")

  const [daypartName, setDaypartName] = useState("Lunch")
  const [daypartDays, setDaypartDays] = useState("1,2,3,4,5")
  const [daypartStart, setDaypartStart] = useState("11:30")
  const [daypartEnd, setDaypartEnd] = useState("15:00")
  const [daypartSections, setDaypartSections] = useState("mains")
  const [daypartItems, setDaypartItems] = useState("")

  const [deliveryChannel, setDeliveryChannel] = useState<"UBER_EATS" | "DELIVEROO" | "JUST_EAT" | "DIRECT">("UBER_EATS")
  const [deliveryRef, setDeliveryRef] = useState("UE-1001")
  const [deliveryTotal, setDeliveryTotal] = useState("42.50")

  const [thresholdInput, setThresholdInput] = useState("5")

  const fetchAll = useCallback(async () => {
    const results = await Promise.allSettled([
      fetchJson<FeatureSummaryDTO>("/api/staff?view=feature-summary", { cache: "no-store" }),
      fetchJson<PromoCodeDTO[]>("/api/staff?view=promos", { cache: "no-store" }),
      fetchJson<ReservationDTO[]>("/api/staff?view=reservations&limit=80", { cache: "no-store" }),
      fetchJson<WaitlistEntryDTO[]>("/api/staff?view=waitlist&limit=80", { cache: "no-store" }),
      fetchJson<LoyaltyAccountDTO[]>("/api/staff?view=loyalty&limit=80", { cache: "no-store" }),
      fetchJson<DeliveryChannelOrderDTO[]>("/api/staff?view=delivery&limit=80", { cache: "no-store" }),
      fetchJson<MenuDaypartDTO[]>("/api/staff?view=dayparts", { cache: "no-store" }),
      fetchJson<InventoryAlertsPayload>("/api/staff?view=inventory-alerts", { cache: "no-store" }),
      fetchJson<FeedbackDTO[]>("/api/staff?view=feedback&limit=80", { cache: "no-store" }),
      fetchJson<NotificationDTO[]>("/api/staff?view=notifications&limit=80", { cache: "no-store" }),
      fetchJson<CustomerCheckoutReceiptDTO[]>("/api/staff?view=receipts&limit=80", { cache: "no-store" }),
    ])

    if (results[0].status === "fulfilled") setSummary(results[0].value)
    if (results[1].status === "fulfilled") setPromos(results[1].value)
    if (results[2].status === "fulfilled") setReservations(results[2].value)
    if (results[3].status === "fulfilled") setWaitlist(results[3].value)
    if (results[4].status === "fulfilled") setLoyalty(results[4].value)
    if (results[5].status === "fulfilled") setDelivery(results[5].value)
    if (results[6].status === "fulfilled") setDayparts(results[6].value)
    if (results[7].status === "fulfilled") {
      setInventory(results[7].value)
      setThresholdInput(String(results[7].value.threshold))
    }
    if (results[8].status === "fulfilled") setFeedback(results[8].value)
    if (results[9].status === "fulfilled") setNotifications(results[9].value)
    if (results[10].status === "fulfilled") setReceipts(results[10].value)
    setLastRefreshedAt(new Date().toLocaleTimeString())
  }, [])

  useEffect(() => {
    fetchAll().catch(err => setError((err as Error).message))
    const timer = setInterval(() => {
      fetchAll().catch(() => {})
    }, 7000)
    return () => clearInterval(timer)
  }, [fetchAll])

  async function postAction(key: string, payload: Record<string, unknown>) {
    setBusy(key)
    setError(null)
    try {
      await fetchJson("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      await fetchAll()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(null)
    }
  }

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

      <div className="mx-auto max-w-[1480px] space-y-4">
        <Card
          variant="elevated"
          className="border-[rgba(111,147,213,0.4)] bg-[linear-gradient(132deg,rgba(15,28,50,0.96),rgba(21,39,66,0.94),rgba(29,52,85,0.92))]"
        >
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div className="space-y-2">
              <div className="text-[10px] uppercase tracking-[0.18em] text-[rgba(184,205,244,0.82)]">
                Growth Control
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-[#eef4ff] md:text-4xl">
                Demand, retention, and channel operations
              </h1>
              <p className="max-w-3xl text-sm leading-6 text-[rgba(197,214,244,0.86)]">
                Manage promo strategy, reservation throughput, waitlist flow,
                loyalty momentum, and delivery channels from one live console.
              </p>
              <div className="flex flex-wrap gap-2 text-xs text-[rgba(203,221,247,0.92)]">
                <span className="rounded-full border border-[rgba(120,161,234,0.46)] bg-[rgba(20,34,58,0.52)] px-2 py-1">
                  Auto refresh every 7s
                </span>
                {lastRefreshedAt ? (
                  <span className="rounded-full border border-[rgba(120,161,234,0.46)] bg-[rgba(20,34,58,0.52)] px-2 py-1">
                    Last synced {lastRefreshedAt}
                  </span>
                ) : null}
                {busy ? (
                  <span className="rounded-full border border-[rgba(120,161,234,0.46)] bg-[rgba(20,34,58,0.52)] px-2 py-1">
                    Action in progress
                  </span>
                ) : null}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Link
                href="/manager"
                className="focus-ring inline-flex min-h-[42px] items-center justify-center rounded-[var(--radius-control)] border border-[rgba(114,153,225,0.56)] bg-[rgba(29,50,81,0.76)] px-3 text-sm font-semibold text-[#dce9ff] transition-colors hover:bg-[rgba(41,67,108,0.92)]"
              >
                Back to manager
              </Link>
              <Link
                href="/manager/customize"
                className="focus-ring inline-flex min-h-[42px] items-center justify-center rounded-[var(--radius-control)] border border-[rgba(114,153,225,0.56)] bg-[rgba(29,50,81,0.76)] px-3 text-sm font-semibold text-[#dce9ff] transition-colors hover:bg-[rgba(41,67,108,0.92)]"
              >
                Customize pages
              </Link>
            </div>
          </div>
        </Card>

        {error && (
          <div className="status-chip status-chip-danger inline-flex">{error}</div>
        )}

        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-7">
          <Card className="border-[rgba(114,153,225,0.34)] bg-[rgba(16,27,47,0.72)]">
            <div className="text-[11px] uppercase tracking-[0.12em] text-[rgba(169,193,234,0.88)]">
              Reservations
            </div>
            <div className="mt-1 text-2xl font-semibold text-[#e8f1ff]">
              {summary?.reservations ?? 0}
            </div>
          </Card>
          <Card className="border-[rgba(114,153,225,0.34)] bg-[rgba(16,27,47,0.72)]">
            <div className="text-[11px] uppercase tracking-[0.12em] text-[rgba(169,193,234,0.88)]">
              Waitlist
            </div>
            <div className="mt-1 text-2xl font-semibold text-[#e8f1ff]">
              {summary?.waitlist ?? 0}
            </div>
          </Card>
          <Card className="border-[rgba(114,153,225,0.34)] bg-[rgba(16,27,47,0.72)]">
            <div className="text-[11px] uppercase tracking-[0.12em] text-[rgba(169,193,234,0.88)]">
              Promos
            </div>
            <div className="mt-1 text-2xl font-semibold text-[#e8f1ff]">
              {summary?.promos ?? 0}
            </div>
          </Card>
          <Card className="border-[rgba(114,153,225,0.34)] bg-[rgba(16,27,47,0.72)]">
            <div className="text-[11px] uppercase tracking-[0.12em] text-[rgba(169,193,234,0.88)]">
              Loyalty
            </div>
            <div className="mt-1 text-2xl font-semibold text-[#e8f1ff]">
              {summary?.loyaltyMembers ?? 0}
            </div>
          </Card>
          <Card className="border-[rgba(114,153,225,0.34)] bg-[rgba(16,27,47,0.72)]">
            <div className="text-[11px] uppercase tracking-[0.12em] text-[rgba(169,193,234,0.88)]">
              Delivery
            </div>
            <div className="mt-1 text-2xl font-semibold text-[#e8f1ff]">
              {summary?.deliveryOrders ?? 0}
            </div>
          </Card>
          <Card className="border-[rgba(114,153,225,0.34)] bg-[rgba(16,27,47,0.72)]">
            <div className="text-[11px] uppercase tracking-[0.12em] text-[rgba(169,193,234,0.88)]">
              Feedback
            </div>
            <div className="mt-1 text-2xl font-semibold text-[#e8f1ff]">
              {summary?.feedback ?? 0}
            </div>
          </Card>
          <Card className="border-[rgba(114,153,225,0.34)] bg-[rgba(16,27,47,0.72)]">
            <div className="text-[11px] uppercase tracking-[0.12em] text-[rgba(169,193,234,0.88)]">
              Notifications
            </div>
            <div className="mt-1 text-2xl font-semibold text-[#e8f1ff]">
              {summary?.notifications ?? 0}
            </div>
          </Card>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <Card className="space-y-3 border-[rgba(114,153,225,0.34)] bg-[rgba(16,27,47,0.72)]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold tracking-tight text-[#e8f1ff]">
                Promotions
              </h2>
              <div className="text-xs text-[rgba(176,199,236,0.85)]">
                {promos.filter(promo => promo.active).length}/{promos.length} active
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-5">
              <input
                className={controlFieldClass}
                value={promoCode}
                onChange={e => setPromoCode(e.target.value)}
                placeholder="Code"
              />
              <input
                className={`${controlFieldClass} md:col-span-2`}
                value={promoDescription}
                onChange={e => setPromoDescription(e.target.value)}
                placeholder="Description"
              />
              <select
                className={controlFieldClass}
                value={promoKind}
                onChange={e => setPromoKind(e.target.value as "PERCENT" | "FIXED")}
              >
                <option value="PERCENT">Percent</option>
                <option value="FIXED">Fixed</option>
              </select>
              <input
                className={controlFieldClass}
                value={promoValue}
                onChange={e => setPromoValue(e.target.value)}
                placeholder="Value"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                className={controlFieldClass}
                value={promoMinSpend}
                onChange={e => setPromoMinSpend(e.target.value)}
                placeholder="Min spend"
              />
              <Button
                disabled={busy !== null}
                onClick={() =>
                  postAction("UPSERT_PROMO", {
                    action: "UPSERT_PROMO",
                    code: promoCode,
                    description: promoDescription,
                    kind: promoKind,
                    value: Number(promoValue || "0"),
                    minSpend: Number(promoMinSpend || "0"),
                    active: true,
                  })
                }
              >
                Save promo
              </Button>
            </div>
            <div className="space-y-2">
              {promos.map(promo => (
                <div
                  key={promo.code}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-control)] border border-[rgba(120,161,234,0.32)] bg-[rgba(20,34,58,0.5)] px-3 py-2"
                >
                  <div className="text-sm">
                    <div className="font-semibold text-[#e8f1ff]">
                      {promo.code} {promo.active ? "(active)" : "(inactive)"}
                    </div>
                    <div className="text-[rgba(183,205,239,0.76)]">
                      {promo.description}
                    </div>
                  </div>
                  <Button
                    variant={promo.active ? "danger" : "primary"}
                    className="min-h-[36px]"
                    disabled={busy !== null}
                    onClick={() =>
                      postAction(`promo:${promo.code}`, {
                        action: "SET_PROMO_ACTIVE",
                        code: promo.code,
                        active: !promo.active,
                      })
                    }
                  >
                    {promo.active ? "Disable" : "Enable"}
                  </Button>
                </div>
              ))}
              {promos.length === 0 ? (
                <div className="rounded-[var(--radius-control)] border border-[rgba(120,161,234,0.32)] bg-[rgba(20,34,58,0.4)] px-3 py-3 text-sm text-[rgba(183,205,239,0.76)]">
                  No promos created yet.
                </div>
              ) : null}
            </div>
          </Card>

          <Card className="space-y-3 border-[rgba(114,153,225,0.34)] bg-[rgba(16,27,47,0.72)]">
            <h2 className="text-lg font-semibold tracking-tight text-[#e8f1ff]">
              Dayparting and Inventory
            </h2>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <input
                className={controlFieldClass}
                value={daypartName}
                onChange={e => setDaypartName(e.target.value)}
                placeholder="Daypart name"
              />
              <input
                className={controlFieldClass}
                value={daypartDays}
                onChange={e => setDaypartDays(e.target.value)}
                placeholder="Days (0-6)"
              />
              <input
                className={controlFieldClass}
                value={daypartStart}
                onChange={e => setDaypartStart(e.target.value)}
                placeholder="Start HH:MM"
              />
              <input
                className={controlFieldClass}
                value={daypartEnd}
                onChange={e => setDaypartEnd(e.target.value)}
                placeholder="End HH:MM"
              />
              <input
                className={`${controlFieldClass} md:col-span-2`}
                value={daypartSections}
                onChange={e => setDaypartSections(e.target.value)}
                placeholder="Section ids (comma list)"
              />
              <input
                className={`${controlFieldClass} md:col-span-2`}
                value={daypartItems}
                onChange={e => setDaypartItems(e.target.value)}
                placeholder="Item ids (optional comma list)"
              />
            </div>
            <Button
              disabled={busy !== null}
              onClick={() =>
                postAction("UPSERT_DAYPART", {
                  action: "UPSERT_DAYPART",
                  name: daypartName,
                  days: daypartDays
                    .split(",")
                    .map(x => Number(x.trim()))
                    .filter(x => Number.isFinite(x)),
                  startTime: daypartStart,
                  endTime: daypartEnd,
                  active: true,
                  sectionIds: daypartSections
                    .split(",")
                    .map(x => x.trim())
                    .filter(Boolean),
                  itemIds: daypartItems
                    .split(",")
                    .map(x => x.trim())
                    .filter(Boolean),
                })
              }
            >
              Add daypart
            </Button>
            <div className="space-y-2">
              {dayparts.map(daypart => (
                <div
                  key={daypart.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-control)] border border-[rgba(120,161,234,0.32)] bg-[rgba(20,34,58,0.5)] px-3 py-2"
                >
                  <div className="text-sm">
                    <div className="font-semibold text-[#e8f1ff]">{daypart.name}</div>
                    <div className="text-[rgba(183,205,239,0.76)]">
                      {daypart.days.join(",")} | {daypart.startTime}-{daypart.endTime}
                    </div>
                  </div>
                  <Button
                    variant="danger"
                    className="min-h-[36px]"
                    disabled={busy !== null}
                    onClick={() =>
                      postAction(`REMOVE_DAYPART:${daypart.id}`, {
                        action: "REMOVE_DAYPART",
                        daypartId: daypart.id,
                      })
                    }
                  >
                    Remove
                  </Button>
                </div>
              ))}
              {dayparts.length === 0 ? (
                <div className="rounded-[var(--radius-control)] border border-[rgba(120,161,234,0.32)] bg-[rgba(20,34,58,0.4)] px-3 py-3 text-sm text-[rgba(183,205,239,0.76)]">
                  No dayparts configured.
                </div>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t border-[rgba(120,161,234,0.26)] pt-3">
              <span className="text-sm text-[rgba(183,205,239,0.84)]">
                Low stock threshold
              </span>
              <input
                className={`${controlFieldClass} w-24 px-2 py-1`}
                value={thresholdInput}
                onChange={e => setThresholdInput(e.target.value)}
              />
              <Button
                variant="secondary"
                className="min-h-[36px]"
                disabled={busy !== null}
                onClick={() =>
                  postAction("SET_LOW_STOCK_THRESHOLD", {
                    action: "SET_LOW_STOCK_THRESHOLD",
                    lowStockThreshold: Number(thresholdInput || "0"),
                  })
                }
              >
                Apply
              </Button>
            </div>
            <div className="max-h-[190px] space-y-1 overflow-y-auto pr-1">
              {(inventory?.alerts ?? []).slice(0, 20).map(alert => (
                <div
                  key={alert.itemId}
                  className="text-sm text-[rgba(183,205,239,0.8)]"
                >
                  {alert.itemName}: {alert.stockCount} left
                </div>
              ))}
              {(inventory?.alerts ?? []).length === 0 ? (
                <div className="text-sm text-[rgba(183,205,239,0.7)]">
                  No low stock alerts right now.
                </div>
              ) : null}
            </div>
          </Card>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <Card className="space-y-3 border-[rgba(114,153,225,0.34)] bg-[rgba(16,27,47,0.72)]">
            <h2 className="text-lg font-semibold tracking-tight text-[#e8f1ff]">
              Reservations and Waitlist
            </h2>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2 rounded-[var(--radius-control)] border border-[rgba(120,161,234,0.3)] bg-[rgba(20,34,58,0.45)] p-3">
                <div className="text-sm font-semibold text-[#e8f1ff]">
                  Reservations
                </div>
                <div className="max-h-[260px] space-y-2 overflow-y-auto pr-1">
                  {reservations.map(entry => (
                    <div
                      key={entry.id}
                      className="rounded-[var(--radius-control)] border border-[rgba(120,161,234,0.3)] bg-[rgba(16,27,47,0.72)] px-3 py-2 text-sm"
                    >
                      <div className="font-semibold text-[#e8f1ff]">
                        {entry.name} ({entry.partySize})
                      </div>
                      <div className="text-[rgba(183,205,239,0.76)]">
                        {new Date(entry.requestedFor).toLocaleString()} |{" "}
                        {entry.status}
                      </div>
                      <div className="mt-1 flex gap-1">
                        <Button
                          className="min-h-[32px] px-2 text-xs"
                          disabled={busy !== null}
                          onClick={() =>
                            postAction(`res:${entry.id}:confirm`, {
                              action: "UPDATE_RESERVATION_STATUS",
                              reservationId: entry.id,
                              reservationStatus: "CONFIRMED",
                            })
                          }
                        >
                          Confirm
                        </Button>
                        <Button
                          variant="quiet"
                          className="min-h-[32px] px-2 text-xs"
                          disabled={busy !== null}
                          onClick={() =>
                            postAction(`res:${entry.id}:seated`, {
                              action: "UPDATE_RESERVATION_STATUS",
                              reservationId: entry.id,
                              reservationStatus: "SEATED",
                            })
                          }
                        >
                          Seat
                        </Button>
                      </div>
                    </div>
                  ))}
                  {reservations.length === 0 ? (
                    <div className="py-3 text-sm text-[rgba(183,205,239,0.74)]">
                      No reservations.
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="space-y-2 rounded-[var(--radius-control)] border border-[rgba(120,161,234,0.3)] bg-[rgba(20,34,58,0.45)] p-3">
                <div className="text-sm font-semibold text-[#e8f1ff]">Waitlist</div>
                <div className="max-h-[260px] space-y-2 overflow-y-auto pr-1">
                  {waitlist.map(entry => (
                    <div
                      key={entry.id}
                      className="rounded-[var(--radius-control)] border border-[rgba(120,161,234,0.3)] bg-[rgba(16,27,47,0.72)] px-3 py-2 text-sm"
                    >
                      <div className="font-semibold text-[#e8f1ff]">
                        {entry.name} ({entry.partySize})
                      </div>
                      <div className="text-[rgba(183,205,239,0.76)]">
                        {new Date(entry.createdAt).toLocaleTimeString()} |{" "}
                        {entry.status}
                      </div>
                      <div className="mt-1 flex gap-1">
                        <Button
                          className="min-h-[32px] px-2 text-xs"
                          disabled={busy !== null}
                          onClick={() =>
                            postAction(`wl:${entry.id}:notify`, {
                              action: "UPDATE_WAITLIST_STATUS",
                              waitlistId: entry.id,
                              waitlistStatus: "NOTIFIED",
                            })
                          }
                        >
                          Notify
                        </Button>
                        <Button
                          variant="quiet"
                          className="min-h-[32px] px-2 text-xs"
                          disabled={busy !== null}
                          onClick={() =>
                            postAction(`wl:${entry.id}:seat`, {
                              action: "UPDATE_WAITLIST_STATUS",
                              waitlistId: entry.id,
                              waitlistStatus: "SEATED",
                            })
                          }
                        >
                          Seat
                        </Button>
                      </div>
                    </div>
                  ))}
                  {waitlist.length === 0 ? (
                    <div className="py-3 text-sm text-[rgba(183,205,239,0.74)]">
                      Waitlist empty.
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </Card>

          <Card className="space-y-3 border-[rgba(114,153,225,0.34)] bg-[rgba(16,27,47,0.72)]">
            <h2 className="text-lg font-semibold tracking-tight text-[#e8f1ff]">
              Delivery Aggregation
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <select
                className={controlFieldClass}
                value={deliveryChannel}
                onChange={e =>
                  setDeliveryChannel(
                    e.target.value as
                      | "UBER_EATS"
                      | "DELIVEROO"
                      | "JUST_EAT"
                      | "DIRECT"
                  )
                }
              >
                <option value="UBER_EATS">Uber Eats</option>
                <option value="DELIVEROO">Deliveroo</option>
                <option value="JUST_EAT">Just Eat</option>
                <option value="DIRECT">Direct</option>
              </select>
              <input
                className={controlFieldClass}
                value={deliveryRef}
                onChange={e => setDeliveryRef(e.target.value)}
                placeholder="External ref"
              />
              <input
                className={`${controlFieldClass} w-28`}
                value={deliveryTotal}
                onChange={e => setDeliveryTotal(e.target.value)}
                placeholder="Total"
              />
              <Button
                disabled={busy !== null}
                onClick={() =>
                  postAction("CREATE_DELIVERY_ORDER", {
                    action: "CREATE_DELIVERY_ORDER",
                    channel: deliveryChannel,
                    externalRef: deliveryRef,
                    amount: Number(deliveryTotal || "0"),
                  })
                }
              >
                Add order
              </Button>
            </div>
            <div className="max-h-[280px] space-y-2 overflow-y-auto pr-1">
              {delivery.map(order => (
                <div
                  key={order.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-control)] border border-[rgba(120,161,234,0.3)] bg-[rgba(20,34,58,0.5)] px-3 py-2 text-sm"
                >
                  <div>
                    <div className="font-semibold text-[#e8f1ff]">
                      {order.channel} | {order.externalRef}
                    </div>
                    <div className="text-[rgba(183,205,239,0.76)]">
                      {fmt(order.total)} | {order.status}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      className="min-h-[32px] px-2 text-xs"
                      disabled={busy !== null}
                      onClick={() =>
                        postAction(`delivery:${order.id}:prep`, {
                          action: "UPDATE_DELIVERY_ORDER_STATUS",
                          deliveryOrderId: order.id,
                          deliveryStatus: "PREPARING",
                        })
                      }
                    >
                      Preparing
                    </Button>
                    <Button
                      variant="quiet"
                      className="min-h-[32px] px-2 text-xs"
                      disabled={busy !== null}
                      onClick={() =>
                        postAction(`delivery:${order.id}:ready`, {
                          action: "UPDATE_DELIVERY_ORDER_STATUS",
                          deliveryOrderId: order.id,
                          deliveryStatus: "READY",
                        })
                      }
                    >
                      Ready
                    </Button>
                  </div>
                </div>
              ))}
              {delivery.length === 0 ? (
                <div className="py-3 text-sm text-[rgba(183,205,239,0.74)]">
                  No delivery orders yet.
                </div>
              ) : null}
            </div>
          </Card>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <Card className="space-y-2 border-[rgba(114,153,225,0.34)] bg-[rgba(16,27,47,0.72)]">
            <h3 className="text-base font-semibold tracking-tight text-[#e8f1ff]">
              Loyalty Top
            </h3>
            <div className="max-h-[220px] space-y-1 overflow-y-auto pr-1">
              {loyalty.slice(0, 20).map(entry => (
                <div key={entry.customerId} className="text-sm">
                  <span className="font-semibold text-[#e8f1ff]">
                    {entry.customerId}
                  </span>
                  <span className="text-[rgba(183,205,239,0.76)]">
                    {" "}
                    | {entry.points} pts | {entry.tier}
                  </span>
                </div>
              ))}
              {loyalty.length === 0 ? (
                <div className="py-3 text-sm text-[rgba(183,205,239,0.74)]">
                  No loyalty members yet.
                </div>
              ) : null}
            </div>
          </Card>

          <Card className="space-y-2 border-[rgba(114,153,225,0.34)] bg-[rgba(16,27,47,0.72)]">
            <h3 className="text-base font-semibold tracking-tight text-[#e8f1ff]">
              Feedback
            </h3>
            <div className="max-h-[220px] space-y-2 overflow-y-auto pr-1">
              {feedback.slice(0, 20).map(entry => (
                <div key={entry.id} className="text-sm">
                  <div className="font-semibold text-[#e8f1ff]">
                    {entry.rating}/5
                  </div>
                  <div className="text-[rgba(183,205,239,0.76)]">
                    {entry.comment}
                  </div>
                </div>
              ))}
              {feedback.length === 0 ? (
                <div className="py-3 text-sm text-[rgba(183,205,239,0.74)]">
                  No feedback entries.
                </div>
              ) : null}
            </div>
          </Card>

          <Card className="space-y-2 border-[rgba(114,153,225,0.34)] bg-[rgba(16,27,47,0.72)]">
            <h3 className="text-base font-semibold tracking-tight text-[#e8f1ff]">
              Recent Notifications
            </h3>
            <div className="max-h-[220px] space-y-2 overflow-y-auto pr-1">
              {notifications.slice(0, 20).map(entry => (
                <div key={entry.id} className="text-sm">
                  <div className="font-semibold text-[#e8f1ff]">
                    {entry.channel} | {entry.recipient}
                  </div>
                  <div className="text-[rgba(183,205,239,0.76)]">
                    {entry.message}
                  </div>
                </div>
              ))}
              {notifications.length === 0 ? (
                <div className="py-3 text-sm text-[rgba(183,205,239,0.74)]">
                  No notifications yet.
                </div>
              ) : null}
            </div>
          </Card>
        </div>

        <Card className="space-y-2 border-[rgba(114,153,225,0.34)] bg-[rgba(16,27,47,0.72)]">
          <h3 className="text-base font-semibold tracking-tight text-[#e8f1ff]">
            Checkout Receipts
          </h3>
          <div className="max-h-[240px] space-y-1 overflow-y-auto pr-1 text-sm text-[rgba(183,205,239,0.82)]">
            {receipts.map(entry => (
              <div key={entry.receiptId}>
                #{entry.receiptId.slice(0, 8)} | Table {entry.tableNumber} |{" "}
                {fmt(entry.totalCharged)} | {entry.method}
              </div>
            ))}
            {receipts.length === 0 ? (
              <div className="py-3 text-[rgba(183,205,239,0.74)]">
                No receipts yet.
              </div>
            ) : null}
          </div>
        </Card>
      </div>
    </div>
  )
}
