"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/Card"
import { Divider } from "@/components/ui/Divider"
import { Button } from "@/components/ui/Button"
import { Toast } from "@/components/ui/Toast"
import { Modal } from "@/components/ui/Modal"
import { useCartStore } from "@/store/useCartStore"
import { useSessionStore } from "@/store/useSessionStore"
import { calculateCartTotals } from "@/lib/pricing"
import {
  applyEditNote,
  getEditNote,
  hasVisibleEdits,
} from "@/lib/itemEdits"
import {
  cartLoadErrorMessage,
  networkErrorMessage,
  readApiErrorInfo,
  sessionConnectErrorMessage,
} from "@/lib/clientApiErrors"

type ReviewStatus = "pending" | "in_progress" | "completed"

type ReviewItem = {
  id: string
  orderItemId?: string
  status?: ReviewStatus
  submittedAt?: string
  menuItemId?: string | null
  ownerClientKey?: string | null
  name: string
  quantity: number
  edits: unknown
  allergens: string[]
  unitPrice: number
  vatRate?: number
  station: "KITCHEN" | "BAR"
  isMine: boolean
  confirmed?: boolean
  canRequesterEdit?: boolean
  ownerInactive?: boolean
}

type PendingMember = {
  clientKey: string
  itemCount: number
  quantity: number
  confirmed: boolean
  isMine: boolean
  inactive: boolean
  hardActivityAt: string
}

type PendingCartResponse = {
  items: ReviewItem[]
  members: PendingMember[]
  requesterConfirmed: boolean
  allMembersConfirmed: boolean
  unconfirmedMemberCount: number
}

type PendingCartPatch = {
  quantity?: number
  edits?: unknown
}

type PendingCartSyncEntry = {
  itemId: string
  sessionId: string
  clientKey: string | null
  patch: PendingCartPatch
  revision: number
}

function toStation(value: unknown): "KITCHEN" | "BAR" {
  return String(value).toUpperCase() === "BAR" ? "BAR" : "KITCHEN"
}

function toStatus(value: unknown): ReviewStatus {
  const normalized = String(value).toLowerCase()
  if (normalized === "completed") return "completed"
  if (normalized === "in_progress") return "in_progress"
  return "pending"
}

function serviceStateLabel(item: ReviewItem) {
  if (item.status === "completed") return "delivered"
  if (item.station === "BAR") return "in the bar"
  return "in the kitchen"
}

function isObject(
  value: unknown
): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  )
}

function getVisibleEditLines(edits: unknown): string[] {
  if (!hasVisibleEdits(edits)) return []

  const lines: string[] = []
  if (isObject(edits) && Array.isArray(edits.modifierSummary)) {
    lines.push(
      ...edits.modifierSummary.filter(
        (value): value is string =>
          typeof value === "string" && value.trim().length > 0
      )
    )
  }

  const note = getEditNote(edits)
  if (note.trim().length > 0) {
    lines.push(`Note: ${note}`)
  }

  if (lines.length > 0) return lines
  return ["modified"]
}

export default function PerUserReviewPage({
  params,
}: {
  params: { tagId: string }
}) {
  const router = useRouter()
  const tagId = params.tagId
  const sessionId = useSessionStore(s => s.sessionId)
  const setSession = useSessionStore(s => s.setSession)
  const clientKey = useSessionStore(s => s.clientKey)
  const ensureClientKey = useSessionStore(s => s.ensureClientKey)
  const clearSubmittedItems = useCartStore(s => s.clearSubmittedItems)

  const [cartItems, setCartItems] = useState<ReviewItem[]>([])
  const [submittedItems, setSubmittedItems] = useState<ReviewItem[]>([])
  const [firstSubmittedAt, setFirstSubmittedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [pendingMembers, setPendingMembers] = useState<PendingMember[]>([])
  const [requesterConfirmed, setRequesterConfirmed] = useState(true)
  const [allMembersConfirmed, setAllMembersConfirmed] = useState(true)
  const [unconfirmedMemberCount, setUnconfirmedMemberCount] = useState(0)
  const [confirmingMine, setConfirmingMine] = useState(false)
  const [editingItem, setEditingItem] = useState<ReviewItem | null>(null)
  const [editDraft, setEditDraft] = useState("")
  const [savingEdit, setSavingEdit] = useState(false)
  const cartItemsRef = useRef<ReviewItem[]>([])
  const syncTimersRef = useRef<Record<string, number>>({})
  const syncInFlightRef = useRef<Record<string, boolean>>({})
  const pendingSyncRef = useRef<Record<string, PendingCartSyncEntry>>({})

  const notifyHeader = () => {
    if (typeof window === "undefined") return
    window.dispatchEvent(new Event("nfc-cart-updated"))
  }

  const loadCartItems = async (): Promise<PendingCartResponse | null> => {
    if (!sessionId) {
      return {
        items: [],
        members: [],
        requesterConfirmed: true,
        allMembersConfirmed: true,
        unconfirmedMemberCount: 0,
      }
    }

    try {
      const res = await fetch("/api/cart/get", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          clientKey,
        }),
      })

      if (!res.ok) {
        const errorInfo = await readApiErrorInfo(res)
        setError(cartLoadErrorMessage(errorInfo))
        if (errorInfo.status >= 500) {
          return null
        }
        return {
          items: [],
          members: [],
          requesterConfirmed: true,
          allMembersConfirmed: true,
          unconfirmedMemberCount: 0,
        }
      }

      const payload = await res.json()
      setError(current =>
        current &&
        (current.toLowerCase().includes("cart") ||
          current.toLowerCase().includes("session"))
          ? null
          : current
      )
      const nextItems: ReviewItem[] = Array.isArray(payload?.items)
        ? (payload.items as any[])
            .map(item => ({
              id: String(item.id),
              menuItemId:
                typeof item.menuItemId === "string"
                  ? item.menuItemId
                  : null,
              ownerClientKey:
                typeof item.ownerClientKey === "string"
                  ? item.ownerClientKey
                  : null,
              name: String(item.name ?? "Item"),
              quantity: Number(item.quantity ?? 0),
              edits: item.edits ?? null,
              allergens: Array.isArray(item.allergens)
                ? item.allergens.filter(
                    (x: unknown): x is string => typeof x === "string"
                  )
                : [],
              unitPrice: Number(item.unitPrice ?? 0),
              vatRate: Number(item.vatRate ?? 0),
              station: toStation(item.station),
              isMine: Boolean(item.isMine),
              confirmed: Boolean(item.confirmed),
              canRequesterEdit: Boolean(item.canRequesterEdit),
              ownerInactive: Boolean(item.inactive),
            }))
            .filter(item => item.quantity > 0)
        : []

      const members: PendingMember[] = Array.isArray(payload?.members)
        ? (payload.members as any[])
            .map(member => ({
              clientKey: String(member.clientKey ?? ""),
              itemCount: Number(member.itemCount ?? 0),
              quantity: Number(member.quantity ?? 0),
              confirmed: Boolean(member.confirmed),
              isMine: Boolean(member.isMine),
              inactive: Boolean(member.inactive),
              hardActivityAt:
                typeof member.hardActivityAt === "string"
                  ? member.hardActivityAt
                  : new Date(0).toISOString(),
            }))
            .filter(member => member.clientKey.length > 0)
        : []

      const activeMembers = members.filter(
        member => !member.inactive
      )
      const fallbackRequesterConfirmed =
        members.find(member => member.isMine)?.confirmed ??
        true
      const fallbackAllMembersConfirmed =
        activeMembers.length === 0
          ? true
          : activeMembers.every(member => member.confirmed)
      const fallbackUnconfirmedCount = activeMembers.filter(
        member => !member.confirmed
      ).length

      return {
        items: nextItems,
        members,
        requesterConfirmed:
          typeof payload?.confirmation?.requesterConfirmed === "boolean"
            ? payload.confirmation.requesterConfirmed
            : fallbackRequesterConfirmed,
        allMembersConfirmed:
          typeof payload?.confirmation?.allMembersConfirmed === "boolean"
            ? payload.confirmation.allMembersConfirmed
            : fallbackAllMembersConfirmed,
        unconfirmedMemberCount:
          typeof payload?.confirmation?.unconfirmedMemberCount === "number"
            ? payload.confirmation.unconfirmedMemberCount
            : fallbackUnconfirmedCount,
      }
    } catch {
      setError(networkErrorMessage("load pending cart items"))
      return null
    }
  }

  const loadSubmittedItems = async (): Promise<{
    items: ReviewItem[]
    firstSubmittedAt: string | null
  } | null> => {
    try {
      const query = new URLSearchParams({ tagId })
      if (sessionId) {
        query.set("sessionId", sessionId)
      }
      if (clientKey) {
        query.set("clientKey", clientKey)
      }

      const res = await fetch(`/api/orders?${query.toString()}`, {
        cache: "no-store",
      })
      if (!res.ok) {
        if (res.status >= 500) {
          return null
        }
        return { items: [], firstSubmittedAt: null }
      }

      const payload = await res.json()
      const nextItems: ReviewItem[] = Array.isArray(payload?.items)
        ? (payload.items as any[])
            .map(item => ({
              id: String(item.orderItemId ?? item.id ?? crypto.randomUUID()),
              orderItemId:
                typeof item.orderItemId === "string"
                  ? item.orderItemId
                  : undefined,
              status: toStatus(item.status),
              submittedAt:
                typeof item.submittedAt === "string"
                  ? item.submittedAt
                  : undefined,
              menuItemId:
                typeof item.menuItemId === "string"
                  ? item.menuItemId
                  : null,
              ownerClientKey:
                typeof item.ownerClientKey === "string"
                  ? item.ownerClientKey
                  : null,
              name: String(item.name ?? "Item"),
              quantity: Number(item.quantity ?? 0),
              edits: item.edits ?? null,
              allergens: Array.isArray(item.allergens)
                ? item.allergens.filter(
                    (x: unknown): x is string => typeof x === "string"
                  )
                : [],
              unitPrice: Number(item.unitPrice ?? 0),
              vatRate: Number(item.vatRate ?? 0),
              station: toStation(item.station),
              isMine: Boolean(item.isMine),
              canRequesterEdit: false,
              ownerInactive: false,
            }))
            .filter(item => item.quantity > 0)
        : []

      return {
        items: nextItems,
        firstSubmittedAt:
          typeof payload?.firstSubmittedAt === "string"
            ? payload.firstSubmittedAt
            : null,
      }
    } catch {
      return null
    }
  }

  const applyPendingState = (pendingCart: PendingCartResponse) => {
    setCartItems(pendingCart.items)
    setPendingMembers(pendingCart.members)
    setRequesterConfirmed(pendingCart.requesterConfirmed)
    setAllMembersConfirmed(pendingCart.allMembersConfirmed)
    setUnconfirmedMemberCount(pendingCart.unconfirmedMemberCount)
  }

  const refreshAll = async (showSpinner: boolean) => {
    if (showSpinner) {
      setLoading(true)
    }

    try {
      const [pendingCart, submitted] = await Promise.all([
        loadCartItems(),
        loadSubmittedItems(),
      ])

      if (pendingCart) {
        applyPendingState(pendingCart)
      }
      if (submitted) {
        setSubmittedItems(submitted.items)
        setFirstSubmittedAt(submitted.firstSubmittedAt)
      }
    } finally {
      if (showSpinner) {
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    ensureClientKey()
  }, [ensureClientKey])

  useEffect(() => {
    if (sessionId) return

    let cancelled = false
    const bootstrapSession = async () => {
      try {
        const res = await fetch("/api/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tagId }),
        })

        if (!res.ok) {
          const errorInfo = await readApiErrorInfo(res)
          if (res.status === 409 && errorInfo.code === "TABLE_CLOSED") {
            router.replace(`/t/${tagId}/closed`)
          } else {
            setError(
              sessionConnectErrorMessage(errorInfo, tagId)
            )
            setLoading(false)
          }
          return
        }

        const payload = await res.json()
        if (cancelled) return
        if (typeof payload?.sessionId === "string" && payload.sessionId.length > 0) {
          setSession(payload.sessionId, "customer")
        }
      } catch {
        if (!cancelled) {
          setError(networkErrorMessage("connect this table"))
          setLoading(false)
        }
      }
    }

    void bootstrapSession()
    return () => {
      cancelled = true
    }
  }, [sessionId, setSession, tagId, router])

  useEffect(() => {
    cartItemsRef.current = cartItems
  }, [cartItems])

  useEffect(() => {
    notifyHeader()
  }, [cartItems])

  useEffect(() => {
    return () => {
      for (const timer of Object.values(syncTimersRef.current)) {
        window.clearTimeout(timer)
      }
      syncTimersRef.current = {}
      syncInFlightRef.current = {}
      pendingSyncRef.current = {}
    }
  }, [])

  useEffect(() => {
    if (!sessionId) return
    void refreshAll(true)
  }, [sessionId, clientKey])

  useEffect(() => {
    if (!sessionId) return

    const timer = window.setInterval(() => {
      void refreshAll(false)
    }, 3000)

    return () => window.clearInterval(timer)
  }, [sessionId, clientKey])

  const isSharedSession = Boolean(sessionId)
  const isItemLockedByRequesterConfirmation = (
    item: ReviewItem
  ) => isSharedSession && requesterConfirmed && item.isMine
  const canEditPendingItem = (item: ReviewItem) =>
    !isItemLockedByRequesterConfirmation(item) &&
    (item.isMine || item.canRequesterEdit === true)

  const memberLabelByClientKey = useMemo(() => {
    const map = new Map<string, string>()
    let guestNumber = 1

    for (const member of pendingMembers) {
      if (member.isMine) continue
      if (!map.has(member.clientKey)) {
        map.set(member.clientKey, `Guest ${guestNumber}`)
        guestNumber += 1
      }
    }

    const fillFromItems = [...cartItems, ...submittedItems]
    for (const item of fillFromItems) {
      if (item.isMine) continue
      const key = item.ownerClientKey
      if (!key || map.has(key)) continue
      map.set(key, `Guest ${guestNumber}`)
      guestNumber += 1
    }

    return map
  }, [pendingMembers, cartItems, submittedItems])

  const myPendingItems = useMemo(
    () => cartItems.filter(item => item.isMine),
    [cartItems]
  )
  const otherPendingItems = useMemo(
    () => cartItems.filter(item => !item.isMine),
    [cartItems]
  )
  const otherPendingGroups = useMemo(() => {
    const grouped = new Map<string, ReviewItem[]>()
    for (const item of otherPendingItems) {
      const key = item.ownerClientKey ?? `unknown:${item.id}`
      const existing = grouped.get(key) ?? []
      existing.push(item)
      grouped.set(key, existing)
    }
    return Array.from(grouped.entries()).map(([clientKey, items]) => {
      const member = pendingMembers.find(
        value => value.clientKey === clientKey
      )
      return {
        clientKey,
        items,
        label:
          memberLabelByClientKey.get(clientKey) ?? "Guest",
        inactive: Boolean(member?.inactive),
      }
    })
  }, [otherPendingItems, pendingMembers, memberLabelByClientKey])

  const inKitchenItems = useMemo(
    () =>
      submittedItems.filter(
        item => item.status !== "completed"
      ),
    [submittedItems]
  )
  const deliveredItems = useMemo(
    () =>
      submittedItems.filter(
        item => item.status === "completed"
      ),
    [submittedItems]
  )

  const activePendingMembers = useMemo(
    () => pendingMembers.filter(member => !member.inactive),
    [pendingMembers]
  )
  const inactivePendingMembers = useMemo(
    () => pendingMembers.filter(member => member.inactive),
    [pendingMembers]
  )

  const mySubmittedItems = useMemo(
    () => submittedItems.filter(item => item.isMine),
    [submittedItems]
  )
  const myVisibleItems = useMemo(
    () => [...mySubmittedItems, ...myPendingItems],
    [mySubmittedItems, myPendingItems]
  )
  const tableVisibleItems = useMemo(
    () => [...submittedItems, ...cartItems],
    [submittedItems, cartItems]
  )
  const sendDisabled =
    submitting ||
    cartItems.length === 0 ||
    (isSharedSession && !allMembersConfirmed)
  const ownerLabelForItem = (item: ReviewItem) => {
    if (item.isMine) return "You"
    if (!item.ownerClientKey) return "Guest"
    return memberLabelByClientKey.get(item.ownerClientKey) ?? "Guest"
  }
  const myTotals = calculateCartTotals(myVisibleItems)
  const tableTotals = calculateCartTotals(tableVisibleItems)

  async function submit() {
    if (cartItems.length === 0) return
    if (!sessionId) {
      setError("Live connection required. Could not send order.")
      return
    }
    if (isSharedSession && !allMembersConfirmed) {
      setError(
        "Every active member with pending items must confirm before sending the table order."
      )
      return
    }

    setSubmitting(true)
    setError(null)

    const activeClientKey = ensureClientKey()
    const payload: {
      sessionId?: string
      tagId: string
      clientKey?: string
      items?: Array<{
        itemId: string
        menuItemId?: string
        name: string
        quantity: number
        edits: unknown
        allergens: string[]
        unitPrice: number
        station: "KITCHEN" | "BAR"
        vatRate: number
      }>
    } = {
      tagId,
      sessionId,
    }

    if (activeClientKey) {
      payload.clientKey = activeClientKey
    }

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const failure = await res
          .json()
          .catch(() => ({}) as { error?: unknown; unconfirmedMemberCount?: unknown })
        const apiError =
          typeof failure?.error === "string"
            ? failure.error
            : "SUBMISSION_FAILED"

        if (apiError === "MEMBER_CONFIRMATION_REQUIRED") {
          const count =
            typeof failure?.unconfirmedMemberCount === "number"
              ? failure.unconfirmedMemberCount
              : null
          setError(
            count && count > 0
              ? `Not sent yet. Waiting for ${count} ${count === 1 ? "member" : "members"} to confirm pending items.`
              : "Not sent yet. Waiting for all active members to confirm their pending items."
          )
          await refreshAll(false)
          return
        }

        throw new Error(`${apiError} (HTTP ${res.status})`)
      }

      clearSubmittedItems()
      applyPendingState({
        items: [],
        members: [],
        requesterConfirmed: true,
        allMembersConfirmed: true,
        unconfirmedMemberCount: 0,
      })
      await refreshAll(false)
    } catch (submitError: any) {
      const message = String(submitError?.message ?? "unknown")
      setError(`Order could not be submitted (${message}).`)
    } finally {
      setSubmitting(false)
      setShowConfirm(false)
    }
  }

  async function setMyPendingConfirmation(nextConfirmed: boolean) {
    if (myPendingItems.length === 0 || !sessionId) return

    const activeClientKey = ensureClientKey()
    if (!activeClientKey) {
      setError("Could not confirm items on this device.")
      return
    }

    setConfirmingMine(true)
    setError(null)

    try {
      const res = await fetch("/api/cart/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          clientKey: activeClientKey,
          confirmed: nextConfirmed,
        }),
      })

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}))
        throw new Error(payload?.error ?? "CONFIRMATION_FAILED")
      }

      const pending = await loadCartItems()
      if (pending) {
        applyPendingState(pending)
      }
    } catch (confirmError: any) {
      setError(
        `Could not ${nextConfirmed ? "confirm" : "unconfirm"} your items (${confirmError?.message ?? "unknown"}).`
      )
    } finally {
      setConfirmingMine(false)
    }
  }

  const applyOptimisticPendingItems = (
    updater: (items: ReviewItem[]) => ReviewItem[]
  ) => {
    setCartItems(current => {
      const next = updater(current)
      cartItemsRef.current = next
      notifyHeader()
      return next
    })
  }

  const markConfirmationStateDirty = (item: ReviewItem) => {
    if (!isSharedSession) return
    if (item.isMine) {
      setRequesterConfirmed(false)
    }
    setAllMembersConfirmed(false)
    setUnconfirmedMemberCount(current =>
      current > 0 ? current : 1
    )
  }

  const flushPendingCartSync = async (itemId: string) => {
    if (syncInFlightRef.current[itemId]) return

    const pending = pendingSyncRef.current[itemId]
    if (!pending) return

    syncInFlightRef.current[itemId] = true
    const requestedRevision = pending.revision

    try {
      const res = await fetch("/api/cart/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: pending.sessionId,
          itemId: pending.itemId,
          clientKey: pending.clientKey,
          ...pending.patch,
        }),
      })

      if (!res.ok) {
        const payload = await res
          .json()
          .catch(() => ({} as { error?: unknown }))
        const apiError =
          typeof payload?.error === "string"
            ? payload.error
            : "CART_ITEM_UPDATE_FAILED"

        if (apiError === "ITEM_CONFIRMED") {
          setError(
            'Your pending items are confirmed. Tap "Edit items" to unconfirm before editing.'
          )
        } else if (apiError === "ASSIST_LOCKED") {
          setError(
            "Assist edit unlocks after 2 minutes of owner inactivity."
          )
        } else {
          setError(
            `Could not update cart item (${apiError}).`
          )
        }

        void refreshAll(false)
      }
    } catch {
      setError(
        "Could not update cart item (network error)."
      )
      void refreshAll(false)
    } finally {
      syncInFlightRef.current[itemId] = false

      const latest = pendingSyncRef.current[itemId]
      if (!latest) return

      if (latest.revision !== requestedRevision) {
        window.setTimeout(() => {
          void flushPendingCartSync(itemId)
        }, 0)
        return
      }

      delete pendingSyncRef.current[itemId]

      const timer = syncTimersRef.current[itemId]
      if (timer) {
        window.clearTimeout(timer)
        delete syncTimersRef.current[itemId]
      }
    }
  }

  const scheduleCartSync = (
    itemId: string,
    sessionForSync: string,
    clientKeyForSync: string | null,
    patch: PendingCartPatch
  ) => {
    const existing = pendingSyncRef.current[itemId]
    const nextRevision = (existing?.revision ?? 0) + 1

    pendingSyncRef.current[itemId] = {
      itemId,
      sessionId: sessionForSync,
      clientKey: clientKeyForSync,
      patch: {
        ...(existing?.patch ?? {}),
        ...patch,
      },
      revision: nextRevision,
    }

    const existingTimer = syncTimersRef.current[itemId]
    if (existingTimer) {
      window.clearTimeout(existingTimer)
    }

    syncTimersRef.current[itemId] = window.setTimeout(() => {
      void flushPendingCartSync(itemId)
    }, 24)
  }

  function setCartQty(item: ReviewItem, nextQty: number) {
    if (nextQty < 0) return
    if (!canEditPendingItem(item)) {
      if (isItemLockedByRequesterConfirmation(item)) {
        setError(
          'Your pending items are confirmed. Tap "Edit items" to unconfirm before editing.'
        )
      }
      return
    }

    setError(null)

    const activeClientKey = ensureClientKey()
    const activeSessionId = sessionId
    if (!activeSessionId) {
      setError("Live connection required. Could not update cart item.")
      return
    }

    applyOptimisticPendingItems(current =>
      current
        .map(currentItem => {
          if (currentItem.id !== item.id) return currentItem
          if (nextQty <= 0) return null
          return {
            ...currentItem,
            quantity: nextQty,
          }
        })
        .filter((currentItem): currentItem is ReviewItem =>
          Boolean(currentItem)
        )
    )
    markConfirmationStateDirty(item)

    scheduleCartSync(
      item.id,
      activeSessionId as string,
      activeClientKey,
      { quantity: nextQty }
    )
  }

  function changeCartQty(itemId: string, delta: 1 | -1) {
    const currentItem = cartItemsRef.current.find(
      item => item.id === itemId
    )
    if (!currentItem) return
    setCartQty(currentItem, currentItem.quantity + delta)
  }

  function openEdit(item: ReviewItem) {
    if (!canEditPendingItem(item)) {
      if (isItemLockedByRequesterConfirmation(item)) {
        setError(
          'Your pending items are confirmed. Tap "Edit items" to unconfirm before editing.'
        )
      }
      return
    }

    setEditingItem(item)
    setEditDraft(getEditNote(item.edits))
  }

  async function saveEdit() {
    if (!editingItem) return

    setSavingEdit(true)
    setError(null)

    try {
      const activeClientKey = ensureClientKey()
      const nextEdits = applyEditNote(
        editingItem.edits,
        editDraft,
        activeClientKey
      )

      if (editingItem.orderItemId) {
        if (!editingItem.isMine) {
          throw new Error("FORBIDDEN")
        }

        const body: {
          orderItemId: string
          edits: unknown
          tagId: string
          clientKey?: string
          sessionId?: string
        } = {
          orderItemId: editingItem.orderItemId,
          edits: nextEdits,
          tagId,
        }

        if (activeClientKey) {
          body.clientKey = activeClientKey
        }
        if (sessionId) {
          body.sessionId = sessionId
        }

        const res = await fetch("/api/orders", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })

        if (!res.ok) {
          const payload = await res.json().catch(() => ({}))
          throw new Error(payload?.error ?? "ORDER_ITEM_EDIT_FAILED")
        }

        const submitted = await loadSubmittedItems()
        if (submitted) {
          setSubmittedItems(submitted.items)
          setFirstSubmittedAt(submitted.firstSubmittedAt)
        }
      } else {
        if (!canEditPendingItem(editingItem)) {
          throw new Error(
            isItemLockedByRequesterConfirmation(editingItem)
              ? "ITEM_CONFIRMED"
              : "FORBIDDEN"
          )
        }

        if (!sessionId) {
          throw new Error("SESSION_NOT_FOUND")
        }

        applyOptimisticPendingItems(current =>
          current.map(item =>
            item.id === editingItem.id
              ? {
                  ...item,
                  edits: nextEdits,
                }
              : item
          )
        )
        markConfirmationStateDirty(editingItem)
        scheduleCartSync(
          editingItem.id,
          sessionId,
          activeClientKey,
          { edits: nextEdits }
        )
      }

      setEditingItem(null)
      setEditDraft("")
    } catch (editError: any) {
      const errorMessage = String(
        editError?.message ?? "unknown"
      )
      if (errorMessage.includes("ITEM_CONFIRMED")) {
        setError(
          'Your pending items are confirmed. Tap "Edit items" to unconfirm before editing.'
        )
        return
      }
      if (errorMessage.includes("ASSIST_LOCKED")) {
        setError(
          "Assist edit unlocks after 2 minutes of owner inactivity."
        )
        return
      }
      setError(
        `Could not update item edits (${errorMessage}).`
      )
    } finally {
      setSavingEdit(false)
    }
  }

  if (loading) {
    return (
      <div className="p-4 opacity-60 text-center">
        Loading review...
      </div>
    )
  }

  if (cartItems.length === 0 && submittedItems.length === 0) {
    return (
      <div className="p-4 space-y-3">
        {error && <Toast>{error}</Toast>}
        <div className="opacity-60 text-center">
          No items to review
        </div>
        <Button
          variant="secondary"
          onClick={() => router.push(`/t/${tagId}`)}
        >
          Back
        </Button>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      {error && <Toast>{error}</Toast>}

      <Card>
        <div className="text-lg font-semibold">
          Review additions
        </div>
        <div className="text-sm opacity-70">
          Pending items stay editable until the table order is sent. Sent items
          are locked.
        </div>
        {firstSubmittedAt && (
          <div className="text-xs opacity-60 mt-2">
            Table has active additions since{" "}
            {new Date(firstSubmittedAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
            .
          </div>
        )}
      </Card>

      {cartItems.length > 0 && (
        <>
          <Divider />
          <Card>
            <div className="text-sm font-semibold mb-2">
              Your pending additions
            </div>
            <div className="text-xs opacity-70 mb-3">
              These stay in review until every active member confirms.
            </div>
            <div className="space-y-3">
              {myPendingItems.map(item => (
                <div
                  key={item.id}
                  className="flex justify-between items-center gap-3"
                >
                  <div>
                    <div className="font-medium">
                      {item.quantity}× {item.name}
                    </div>
                    {getVisibleEditLines(item.edits).map(line => (
                      <div
                        key={`${item.id}-${line}`}
                        className="text-xs opacity-60"
                      >
                        {line}
                      </div>
                    ))}
                    {item.allergens.length > 0 && (
                      <div className="text-xs opacity-60">
                        Allergens: {item.allergens.join(", ")}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="px-2 py-1 rounded border"
                      disabled={
                        submitting ||
                        !canEditPendingItem(item)
                      }
                      onClick={() => changeCartQty(item.id, -1)}
                    >
                      −
                    </button>
                    <span className="min-w-8 text-center text-sm font-medium">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      className="px-2 py-1 rounded border"
                      disabled={
                        submitting ||
                        !canEditPendingItem(item)
                      }
                      onClick={() => changeCartQty(item.id, 1)}
                    >
                      +
                    </button>
                    <button
                      type="button"
                      className="px-2 py-1 rounded border"
                      disabled={
                        submitting ||
                        !canEditPendingItem(item)
                      }
                      onClick={() => openEdit(item)}
                    >
                      Edit
                    </button>
                    <div className="text-sm min-w-16 text-right">
                      £{(item.unitPrice * item.quantity).toFixed(2)}
                    </div>
                  </div>
                </div>
              ))}
              {myPendingItems.length === 0 && (
                <div className="text-xs opacity-60">
                  You have no pending items.
                </div>
              )}
            </div>

            {otherPendingGroups.length > 0 && (
              <>
                <Divider />
                <div className="text-sm font-semibold mb-2">
                  Other members at your table ordered
                </div>
                <div className="text-xs opacity-70 mb-3">
                  Grouped by guest. You can assist-edit items after 2 minutes of
                  inactivity.
                </div>
                <div className="space-y-4">
                  {otherPendingGroups.map(group => (
                    <div key={group.clientKey} className="space-y-2">
                      <div className="text-xs font-semibold opacity-70">
                        {group.label}
                        {group.inactive ? " · inactive" : ""}
                      </div>
                      <div className="space-y-2">
                        {group.items.map(item => (
                          <div
                            key={item.id}
                            className="flex justify-between items-center gap-3 rounded border px-3 py-2 opacity-80"
                            style={{
                              background: "rgba(145, 158, 173, 0.16)",
                              borderColor: "rgba(110, 128, 145, 0.32)",
                            }}
                          >
                            <div>
                              <div className="font-medium">
                                {item.quantity}× {item.name}
                              </div>
                              {getVisibleEditLines(item.edits).map(line => (
                                <div
                                  key={`${item.id}-${line}`}
                                  className="text-xs opacity-60"
                                >
                                  {line}
                                </div>
                              ))}
                              {item.canRequesterEdit && (
                                <div className="text-xs opacity-60">
                                  Assist edit enabled
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {item.canRequesterEdit && (
                                <>
                                  <button
                                    type="button"
                                    className="px-2 py-1 rounded border"
                                    disabled={
                                      submitting ||
                                      !canEditPendingItem(item)
                                    }
                                    onClick={() =>
                                      changeCartQty(item.id, -1)
                                    }
                                  >
                                    −
                                  </button>
                                  <span className="min-w-8 text-center text-sm font-medium">
                                    {item.quantity}
                                  </span>
                                  <button
                                    type="button"
                                    className="px-2 py-1 rounded border"
                                    disabled={
                                      submitting ||
                                      !canEditPendingItem(item)
                                    }
                                    onClick={() =>
                                      changeCartQty(item.id, 1)
                                    }
                                  >
                                    +
                                  </button>
                                  <button
                                    type="button"
                                    className="px-2 py-1 rounded border"
                                    disabled={
                                      submitting ||
                                      !canEditPendingItem(item)
                                    }
                                    onClick={() => openEdit(item)}
                                  >
                                    Edit
                                  </button>
                                </>
                              )}
                              <div className="text-sm min-w-16 text-right">
                                £{(item.unitPrice * item.quantity).toFixed(2)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {isSharedSession && cartItems.length > 0 && (
              <>
                <Divider />
                <div className="flex justify-between items-center gap-2">
                  <div className="text-xs opacity-70">
                    {requesterConfirmed
                      ? "Your pending items are confirmed. Unconfirm to edit before send."
                      : "Confirm your items first."}
                  </div>
                  <Button
                    type="button"
                    variant={requesterConfirmed ? "secondary" : "primary"}
                    disabled={
                      confirmingMine ||
                      myPendingItems.length === 0
                    }
                    onClick={() =>
                      setMyPendingConfirmation(!requesterConfirmed)
                    }
                  >
                    {requesterConfirmed
                      ? "Edit items"
                      : "Confirm my items"}
                  </Button>
                </div>
              </>
            )}

            {isSharedSession && pendingMembers.length > 0 && (
              <div className="text-xs opacity-60 mt-2">
                {activePendingMembers.filter(member => member.confirmed).length}/
                {activePendingMembers.length} active members confirmed
                {inactivePendingMembers.length > 0 &&
                  ` · ${inactivePendingMembers.length} inactive`}
              </div>
            )}
          </Card>
        </>
      )}

      {inKitchenItems.length > 0 && (
        <>
          <Divider />
          <Card>
            <div className="text-sm font-semibold mb-2">
              In the kitchen / bar
            </div>
            <div className="text-xs opacity-70 mb-3">
              Sent items are locked. Status updates automatically.
            </div>
            <div className="space-y-3">
              {inKitchenItems.map(item => (
                <div
                  key={item.id}
                  className="flex justify-between items-center gap-3 rounded border px-3 py-2 opacity-80"
                  style={{
                    background: "rgba(145, 158, 173, 0.16)",
                    borderColor: "rgba(110, 128, 145, 0.32)",
                  }}
                >
                  <div>
                    <div className="font-medium">
                      {item.quantity}× {item.name}
                    </div>
                    <div className="text-xs opacity-60">
                      {ownerLabelForItem(item)} · {serviceStateLabel(item)}
                    </div>
                    {getVisibleEditLines(item.edits).map(line => (
                      <div
                        key={`${item.id}-${line}`}
                        className="text-xs opacity-60"
                      >
                        {line}
                      </div>
                    ))}
                  </div>

                  <div className="text-sm min-w-16 text-right">
                    £{(item.unitPrice * item.quantity).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}

      {deliveredItems.length > 0 && (
        <>
          <Divider />
          <Card>
            <div className="text-sm font-semibold mb-2">
              Delivered
            </div>
            <div className="text-xs opacity-70 mb-3">
              Completed items for this table.
            </div>
            <div className="space-y-3">
              {deliveredItems.map(item => (
                <div
                  key={item.id}
                  className="flex justify-between items-center gap-3 rounded border px-3 py-2 opacity-70"
                  style={{
                    background: "rgba(145, 158, 173, 0.12)",
                    borderColor: "rgba(110, 128, 145, 0.28)",
                  }}
                >
                  <div>
                    <div className="font-medium">
                      {item.quantity}× {item.name}
                    </div>
                    <div className="text-xs opacity-60">
                      {ownerLabelForItem(item)} · delivered
                    </div>
                  </div>

                  <div className="text-sm min-w-16 text-right">
                    £{(item.unitPrice * item.quantity).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}

      <Divider />

      <Card>
        <div className="text-sm font-semibold mb-2">
          Totals
        </div>
        <div className="flex justify-between text-sm">
          <div>Your items total</div>
          <div>£{myTotals.total.toFixed(2)}</div>
        </div>
        <Divider />
        <div className="flex justify-between text-sm">
          <div>Table subtotal</div>
          <div>£{tableTotals.subtotal.toFixed(2)}</div>
        </div>
        <div className="flex justify-between text-sm opacity-70">
          <div>Table VAT</div>
          <div>£{tableTotals.vat.toFixed(2)}</div>
        </div>
        <Divider />
        <div className="flex justify-between font-semibold">
          <div>Table total</div>
          <div>£{tableTotals.total.toFixed(2)}</div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="secondary"
          onClick={() => router.push(`/t/${tagId}`)}
          disabled={submitting}
        >
          Back
        </Button>

        <Button
          onClick={() => setShowConfirm(true)}
          disabled={sendDisabled}
        >
          Send table order
        </Button>
      </div>

      {isSharedSession && cartItems.length > 0 && !allMembersConfirmed && (
        <div className="text-xs opacity-70 text-center">
          Waiting for {unconfirmedMemberCount}{" "}
          {unconfirmedMemberCount === 1 ? "active member" : "active members"} to confirm
          pending items.
        </div>
      )}

      {showConfirm && (
        <Modal
          title="send table order?"
          onCancel={() => setShowConfirm(false)}
          onConfirm={submit}
          confirmDisabled={sendDisabled}
        >
          <p className="text-center">
            This will send the confirmed table order to kitchen and bar. You
            can still add more items afterwards.
          </p>
        </Modal>
      )}

      {editingItem && (
        <Modal
          title={`edit ${editingItem.name}`}
          onCancel={() => {
            setEditingItem(null)
            setEditDraft("")
          }}
          onConfirm={saveEdit}
          confirmDisabled={savingEdit}
        >
          <div className="space-y-2">
            <label
              htmlFor="item-edit-note"
              className="text-xs opacity-70"
            >
              Special request note
            </label>
            <textarea
              id="item-edit-note"
              className="w-full border rounded p-2"
              rows={4}
              value={editDraft}
              onChange={event => setEditDraft(event.target.value)}
              placeholder="No onions, extra crispy, sauce on side..."
            />
            <p className="text-xs opacity-60">
              Leave this blank to clear the note.
            </p>
          </div>
        </Modal>
      )}
    </div>
  )
}
