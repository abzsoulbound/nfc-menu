"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { fetchJson } from "@/lib/fetchJson"
import { trackUxFunnelEventClient } from "@/lib/uxClient"
import {
  LoyaltyAccountDTO,
  PromoCodeDTO,
  ReservationDTO,
  WaitlistEntryDTO,
} from "@/lib/types"
import { useUxFunnelTracking } from "@/lib/useUxFunnelTracking"
import { useRestaurantStore } from "@/store/useRestaurantStore"

type NotificationDTO = {
  id: string
  channel: "SMS" | "EMAIL" | "IN_APP"
  recipient: string
  message: string
  createdAt: string
}

type GuestToolsTab =
  | "account"
  | "promos"
  | "reservation"
  | "waitlist"
  | "feedback"
  | "notifications"

export default function GuestToolsPage() {
  const uxTracking = useUxFunnelTracking({
    page: "guest_tools",
    step: "engage",
  })
  const [promos, setPromos] = useState<PromoCodeDTO[]>([])
  const [customerId, setCustomerId] = useState("")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [marketingOptIn, setMarketingOptIn] = useState(false)
  const [loyalty, setLoyalty] = useState<LoyaltyAccountDTO | null>(null)

  const [reservationName, setReservationName] = useState("")
  const [reservationPhone, setReservationPhone] = useState("")
  const [reservationPartySize, setReservationPartySize] = useState("2")
  const [reservationFor, setReservationFor] = useState("")
  const [reservation, setReservation] = useState<ReservationDTO | null>(null)

  const [waitName, setWaitName] = useState("")
  const [waitPhone, setWaitPhone] = useState("")
  const [waitPartySize, setWaitPartySize] = useState("2")
  const [waitlistEntry, setWaitlistEntry] = useState<WaitlistEntryDTO | null>(null)

  const [feedbackRating, setFeedbackRating] = useState("5")
  const [feedbackComment, setFeedbackComment] = useState("")
  const [feedbackSent, setFeedbackSent] = useState(false)

  const [notificationRecipient, setNotificationRecipient] = useState("")
  const [notifications, setNotifications] = useState<NotificationDTO[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const engagementFlow = useRestaurantStore(
    s => s.experienceConfig.ux.engagement
  )
  const [activeTab, setActiveTab] = useState<GuestToolsTab>(
    "account"
  )

  const tabs: { id: GuestToolsTab; label: string }[] = [
    { id: "account", label: "Account" },
    { id: "promos", label: "Promos" },
    { id: "reservation", label: "Reservation" },
    { id: "waitlist", label: "Waitlist" },
    { id: "feedback", label: "Feedback" },
    { id: "notifications", label: "Notifications" },
  ]
  const tabMode = engagementFlow === "TASK_TABS"
  const postPurchaseMode = engagementFlow === "POST_PURCHASE_PROMPT"

  useEffect(() => {
    if (!postPurchaseMode) return
    setActiveTab("feedback")
  }, [postPurchaseMode])

  function showCard(tab: GuestToolsTab) {
    if (!tabMode) return true
    return activeTab === tab
  }

  useEffect(() => {
    fetchJson<PromoCodeDTO[]>("/api/customer/engagement?view=promos", {
      cache: "no-store",
    })
      .then(data => setPromos(data))
      .catch(() => {})
  }, [])

  async function upsertAccount() {
    setBusy(true)
    setError(null)
    try {
      const account = await fetchJson<{ id: string }>("/api/customer/engagement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "UPSERT_ACCOUNT",
          customerId: customerId || null,
          name: name || null,
          email: email || null,
          phone: phone || null,
          marketingOptIn,
        }),
      })
      setCustomerId(account.id)

      const loyaltyResponse = await fetchJson<{
        loyalty: LoyaltyAccountDTO | null
      }>(`/api/customer/engagement?view=loyalty&customerId=${encodeURIComponent(account.id)}`, {
        headers: {
          "x-customer-id": account.id,
        },
        cache: "no-store",
      })
      setLoyalty(loyaltyResponse.loyalty)
      void trackUxFunnelEventClient({
        sessionId: uxTracking.sessionId || "guest-tools",
        eventName: "guest_tools_account_saved",
        page: "guest_tools",
        step: "account",
        experimentKey: uxTracking.experimentKey ?? undefined,
        variantKey: uxTracking.variantKey ?? undefined,
      })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function submitReservation() {
    setBusy(true)
    setError(null)
    try {
      const created = await fetchJson<ReservationDTO>("/api/customer/engagement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CREATE_RESERVATION",
          name: reservationName,
          phone: reservationPhone,
          partySize: Number(reservationPartySize || "0"),
          requestedFor: reservationFor,
        }),
      })
      setReservation(created)
      void trackUxFunnelEventClient({
        sessionId: uxTracking.sessionId || "guest-tools",
        eventName: "guest_tools_reservation_submitted",
        page: "guest_tools",
        step: "reservation",
        experimentKey: uxTracking.experimentKey ?? undefined,
        variantKey: uxTracking.variantKey ?? undefined,
      })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function submitWaitlist() {
    setBusy(true)
    setError(null)
    try {
      const created = await fetchJson<WaitlistEntryDTO>("/api/customer/engagement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CREATE_WAITLIST",
          name: waitName,
          phone: waitPhone,
          partySize: Number(waitPartySize || "0"),
        }),
      })
      setWaitlistEntry(created)
      void trackUxFunnelEventClient({
        sessionId: uxTracking.sessionId || "guest-tools",
        eventName: "guest_tools_waitlist_submitted",
        page: "guest_tools",
        step: "waitlist",
        experimentKey: uxTracking.experimentKey ?? undefined,
        variantKey: uxTracking.variantKey ?? undefined,
      })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function submitFeedback() {
    setBusy(true)
    setError(null)
    try {
      await fetchJson("/api/customer/engagement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CREATE_FEEDBACK",
          customerId: customerId || null,
          rating: Number(feedbackRating || "0"),
          comment: feedbackComment,
        }),
      })
      setFeedbackSent(true)
      setFeedbackComment("")
      void trackUxFunnelEventClient({
        sessionId: uxTracking.sessionId || "guest-tools",
        eventName: "guest_tools_feedback_submitted",
        page: "guest_tools",
        step: "feedback",
        experimentKey: uxTracking.experimentKey ?? undefined,
        variantKey: uxTracking.variantKey ?? undefined,
      })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function fetchNotifications() {
    setBusy(true)
    setError(null)
    try {
      const notificationHeaders: Record<string, string> = {}
      if (notificationRecipient.startsWith("session:")) {
        const sessionId = notificationRecipient.slice("session:".length).trim()
        if (sessionId) {
          notificationHeaders["x-session-id"] = sessionId
        }
      }
      const data = await fetchJson<NotificationDTO[]>(
        `/api/customer/engagement?view=notifications&recipient=${encodeURIComponent(notificationRecipient)}`,
        {
          headers:
            Object.keys(notificationHeaders).length > 0
              ? notificationHeaders
              : undefined,
        }
      )
      setNotifications(data)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="px-4 py-5 md:px-6 md:py-6">
      <div className="mx-auto max-w-[980px] space-y-4">
        <Card variant="elevated">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight">Guest Tools</h1>
            <p className="text-sm text-secondary">
              Account, loyalty, promos, reservations, waitlist, and feedback.
            </p>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="status-chip status-chip-neutral">
                {tabMode
                  ? "Task-by-task tab flow"
                  : postPurchaseMode
                    ? "Post-purchase follow-up flow"
                    : "All-in-one flow"}
              </span>
              <span className="status-chip status-chip-neutral">
                Engagement workspace
              </span>
            </div>
            <Link
              href="/menu"
              className="focus-ring inline-flex min-h-[40px] items-center justify-center rounded-[var(--radius-control)] border border-[var(--border)] px-3 text-sm font-semibold"
            >
              Back to menu
            </Link>
          </div>
        </Card>

        {error && <div className="status-chip status-chip-danger inline-flex">{error}</div>}

        {postPurchaseMode && (
          <Card className="space-y-2 border-[rgba(201,169,110,0.34)] bg-[rgba(255,255,255,0.72)]">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
              Recommended Next Actions
            </div>
            <div className="text-sm text-secondary">
              Ask for quick feedback first, then save account details for loyalty and future offers.
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => setActiveTab("feedback")}
              >
                Capture feedback
              </Button>
              <Button
                variant="quiet"
                disabled={busy}
                onClick={() => setActiveTab("account")}
              >
                Save account
              </Button>
            </div>
          </Card>
        )}

        {tabMode && (
          <div className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.62)] p-2">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`focus-ring shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition-all duration-150 ${
                    activeTab === tab.id
                      ? "border-transparent bg-[var(--accent-action)] text-white"
                      : "border-[var(--border)] bg-[rgba(255,255,255,0.68)] text-[var(--text-primary)]"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {showCard("account") && (
          <Card className="space-y-3">
            <h2 className="text-lg font-semibold tracking-tight">Customer Account & Loyalty</h2>
            <input className="w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-transparent px-3 py-2 text-sm" value={customerId} onChange={e => setCustomerId(e.target.value)} placeholder="Customer ID (optional)" />
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <input className="rounded-[var(--radius-control)] border border-[var(--border)] bg-transparent px-3 py-2 text-sm" value={name} onChange={e => setName(e.target.value)} placeholder="Name" />
              <input className="rounded-[var(--radius-control)] border border-[var(--border)] bg-transparent px-3 py-2 text-sm" value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone" />
            </div>
            <input className="w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-transparent px-3 py-2 text-sm" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={marketingOptIn} onChange={e => setMarketingOptIn(e.target.checked)} />
              Optional: receive offers and updates
            </label>
            <Button disabled={busy} onClick={upsertAccount}>Save account</Button>
            {loyalty && (
              <div className="text-sm text-secondary">
                Points: {loyalty.points} | Tier: {loyalty.tier}
              </div>
            )}
          </Card>
          )}

          {showCard("promos") && (
          <Card className="space-y-3">
            <h2 className="text-lg font-semibold tracking-tight">Active Promotions</h2>
            <div className="space-y-2">
              {promos.filter(p => p.active).map(promo => (
                <div key={promo.code} className="rounded-[var(--radius-control)] border border-[var(--border)] px-3 py-2 text-sm">
                  <div className="font-semibold">{promo.code}</div>
                  <div className="text-secondary">{promo.description}</div>
                </div>
              ))}
            </div>
          </Card>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {showCard("reservation") && (
          <Card className="space-y-3">
            <h2 className="text-lg font-semibold tracking-tight">Reservation</h2>
            <input className="w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-transparent px-3 py-2 text-sm" value={reservationName} onChange={e => setReservationName(e.target.value)} placeholder="Name" />
            <input className="w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-transparent px-3 py-2 text-sm" value={reservationPhone} onChange={e => setReservationPhone(e.target.value)} placeholder="Phone" />
            <div className="grid grid-cols-2 gap-2">
              <input className="rounded-[var(--radius-control)] border border-[var(--border)] bg-transparent px-3 py-2 text-sm" value={reservationPartySize} onChange={e => setReservationPartySize(e.target.value)} placeholder="Party size" />
              <input type="datetime-local" className="rounded-[var(--radius-control)] border border-[var(--border)] bg-transparent px-3 py-2 text-sm" value={reservationFor} onChange={e => setReservationFor(e.target.value)} />
            </div>
            <Button disabled={busy} onClick={submitReservation}>Request reservation</Button>
            {reservation && <div className="text-sm text-secondary">Status: {reservation.status}</div>}
          </Card>
          )}

          {showCard("waitlist") && (
          <Card className="space-y-3">
            <h2 className="text-lg font-semibold tracking-tight">Join Waitlist</h2>
            <input className="w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-transparent px-3 py-2 text-sm" value={waitName} onChange={e => setWaitName(e.target.value)} placeholder="Name" />
            <input className="w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-transparent px-3 py-2 text-sm" value={waitPhone} onChange={e => setWaitPhone(e.target.value)} placeholder="Phone" />
            <input className="w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-transparent px-3 py-2 text-sm" value={waitPartySize} onChange={e => setWaitPartySize(e.target.value)} placeholder="Party size" />
            <Button disabled={busy} onClick={submitWaitlist}>Join waitlist</Button>
            {waitlistEntry && <div className="text-sm text-secondary">Status: {waitlistEntry.status}</div>}
          </Card>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {showCard("feedback") && (
          <Card className="space-y-3">
            <h2 className="text-lg font-semibold tracking-tight">Feedback</h2>
            <div className="grid grid-cols-2 gap-2">
              <input className="rounded-[var(--radius-control)] border border-[var(--border)] bg-transparent px-3 py-2 text-sm" value={feedbackRating} onChange={e => setFeedbackRating(e.target.value)} placeholder="Rating 1-5" />
              <input className="rounded-[var(--radius-control)] border border-[var(--border)] bg-transparent px-3 py-2 text-sm" value={customerId} onChange={e => setCustomerId(e.target.value)} placeholder="Customer ID" />
            </div>
            <textarea className="min-h-[96px] w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-transparent px-3 py-2 text-sm" value={feedbackComment} onChange={e => setFeedbackComment(e.target.value)} placeholder="Tell us about your visit" />
            <Button disabled={busy} onClick={submitFeedback}>Submit feedback</Button>
            {feedbackSent && <div className="text-sm text-secondary">Feedback sent. Thank you.</div>}
          </Card>
          )}

          {showCard("notifications") && (
          <Card className="space-y-3">
            <h2 className="text-lg font-semibold tracking-tight">Notifications</h2>
            <input className="w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-transparent px-3 py-2 text-sm" value={notificationRecipient} onChange={e => setNotificationRecipient(e.target.value)} placeholder="recipient (email:.. or session:..)" />
            <Button disabled={busy || notificationRecipient.trim() === ""} onClick={fetchNotifications}>Load notifications</Button>
            <div className="max-h-[190px] space-y-2 overflow-y-auto pr-1">
              {notifications.map(item => (
                <div key={item.id} className="rounded-[var(--radius-control)] border border-[var(--border)] px-3 py-2 text-sm">
                  <div className="font-semibold">{item.channel}</div>
                  <div className="text-secondary">{item.message}</div>
                </div>
              ))}
            </div>
          </Card>
          )}
        </div>
      </div>
    </div>
  )
}
