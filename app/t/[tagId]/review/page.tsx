"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/Card"
import { Divider } from "@/components/ui/Divider"
import { Button } from "@/components/ui/Button"
import { Toast } from "@/components/ui/Toast"
import { Modal } from "@/components/ui/Modal"
import { useCartStore } from "@/store/useCartStore"
import { useSessionStore } from "@/store/useSessionStore"
import { calculateCartTotals } from "@/lib/pricing"
import { queueOrderSubmission } from "@/lib/offlineOrders"
import {
  applyEditNote,
  getEditNote,
  hasVisibleEdits,
} from "@/lib/itemEdits"

type ReviewStatus = "pending" | "in_progress" | "completed"

type ReviewItem = {
  id: string
  orderItemId?: string
  status?: ReviewStatus
  submittedAt?: string
  menuItemId?: string | null
  name: string
  quantity: number
  edits: unknown
  allergens: string[]
  unitPrice: number
  vatRate?: number
  station: "KITCHEN" | "BAR"
  isMine: boolean
  confirmed?: boolean
}

type LocalCartItem = {
  id?: string
  menuItemId?: string | null
  name?: string
  quantity?: number
  edits?: unknown
  allergens?: unknown
  unitPrice?: number
  vatRate?: number
  station?: unknown
}

type PendingMember = {
  clientKey: string
  itemCount: number
  quantity: number
  confirmed: boolean
  isMine: boolean
}

type PendingCartResponse = {
  items: ReviewItem[]
  members: PendingMember[]
  requesterConfirmed: boolean
  allMembersConfirmed: boolean
  unconfirmedMemberCount: number
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

function submittedStateLabel(status?: ReviewStatus) {
  if (status === "completed") return "sent · completed"
  if (status === "in_progress") return "sent · in progress"
  return "sent"
}

export default function PerUserReviewPage({
  params,
}: {
  params: { tagId: string }
}) {
  const router = useRouter()
  const tagId = params.tagId
  const localCartKey = `nfc-pos.local-cart.${tagId}`
  const clientKeyStorage = "nfc-pos.client-key.v1"

  const { sessionId } = useSessionStore()
  const clearSubmittedItems = useCartStore(s => s.clearSubmittedItems)

  const [cartItems, setCartItems] = useState<ReviewItem[]>([])
  const [submittedItems, setSubmittedItems] = useState<ReviewItem[]>([])
  const [firstSubmittedAt, setFirstSubmittedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [updatingCartItemId, setUpdatingCartItemId] = useState<string | null>(null)
  const [updatingOrderItemId, setUpdatingOrderItemId] = useState<string | null>(null)
  const [pendingMembers, setPendingMembers] = useState<PendingMember[]>([])
  const [requesterConfirmed, setRequesterConfirmed] = useState(true)
  const [allMembersConfirmed, setAllMembersConfirmed] = useState(true)
  const [unconfirmedMemberCount, setUnconfirmedMemberCount] = useState(0)
  const [confirmingMine, setConfirmingMine] = useState(false)
  const [editingItem, setEditingItem] = useState<ReviewItem | null>(null)
  const [editDraft, setEditDraft] = useState("")
  const [savingEdit, setSavingEdit] = useState(false)
  const [clientKey, setClientKey] = useState<string | null>(null)

  const ensureClientKey = () => {
    if (typeof window === "undefined") return null

    try {
      const existing = localStorage.getItem(clientKeyStorage)
      if (existing && existing.trim().length > 0) {
        if (clientKey !== existing) {
          setClientKey(existing)
        }
        return existing
      }

      const next = crypto.randomUUID()
      localStorage.setItem(clientKeyStorage, next)
      setClientKey(next)
      return next
    } catch {
      return null
    }
  }

  const readLocalItems = (): ReviewItem[] => {
    try {
      const raw = localStorage.getItem(localCartKey)
      if (!raw) return []
      const parsed = JSON.parse(raw) as LocalCartItem[]
      if (!Array.isArray(parsed)) return []

      return parsed
        .map(item => ({
          id: String(
            item.id ??
              `local:${item.menuItemId ?? item.name ?? crypto.randomUUID()}`
          ),
          menuItemId:
            typeof item.menuItemId === "string"
              ? item.menuItemId
              : null,
          name: String(item.name ?? "Item"),
          quantity: Number(item.quantity ?? 0),
          edits: item.edits ?? null,
          allergens: Array.isArray(item.allergens)
            ? item.allergens.filter((x): x is string => typeof x === "string")
            : [],
          unitPrice: Number(item.unitPrice ?? 0),
          vatRate: Number(item.vatRate ?? 0),
          station: toStation(item.station),
          isMine: true,
          confirmed: true,
        }))
        .filter(item => item.quantity > 0)
    } catch {
      return []
    }
  }

  const writeLocalItems = (items: ReviewItem[]) => {
    try {
      const serializable: LocalCartItem[] = items.map(item => ({
        id: item.id,
        menuItemId: item.menuItemId ?? null,
        name: item.name,
        quantity: item.quantity,
        edits: item.edits,
        allergens: item.allergens,
        unitPrice: item.unitPrice,
        vatRate: item.vatRate,
        station: item.station,
      }))
      localStorage.setItem(localCartKey, JSON.stringify(serializable))
    } catch {
      // best-effort cache only
    }
  }

  const clearLocalCart = () => {
    try {
      localStorage.removeItem(localCartKey)
    } catch {
      // best-effort cache clear only
    }
  }

  const loadCartItems = async (): Promise<PendingCartResponse> => {
    if (!sessionId || sessionId.startsWith("local:")) {
      return {
        items: readLocalItems(),
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
        return {
          items: readLocalItems(),
          members: [],
          requesterConfirmed: true,
          allMembersConfirmed: true,
          unconfirmedMemberCount: 0,
        }
      }

      const payload = await res.json()
      const nextItems: ReviewItem[] = Array.isArray(payload?.items)
        ? (payload.items as any[])
            .map(item => ({
              id: String(item.id),
              menuItemId:
                typeof item.menuItemId === "string"
                  ? item.menuItemId
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
            }))
            .filter(member => member.clientKey.length > 0)
        : []

      const fallbackRequesterConfirmed =
        members.find(member => member.isMine)?.confirmed ??
        true
      const fallbackAllMembersConfirmed =
        members.length === 0
          ? true
          : members.every(member => member.confirmed)
      const fallbackUnconfirmedCount = members.filter(
        member => !member.confirmed
      ).length

      writeLocalItems(nextItems.filter(item => item.isMine))
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
      return {
        items: readLocalItems(),
        members: [],
        requesterConfirmed: true,
        allMembersConfirmed: true,
        unconfirmedMemberCount: 0,
      }
    }
  }

  const loadSubmittedItems = async (): Promise<{
    items: ReviewItem[]
    firstSubmittedAt: string | null
  }> => {
    try {
      const query = new URLSearchParams({ tagId })
      if (sessionId && !sessionId.startsWith("local:")) {
        query.set("sessionId", sessionId)
      }
      if (clientKey) {
        query.set("clientKey", clientKey)
      }

      const res = await fetch(`/api/orders?${query.toString()}`, {
        cache: "no-store",
      })
      if (!res.ok) {
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
      return { items: [], firstSubmittedAt: null }
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

      applyPendingState(pendingCart)
      setSubmittedItems(submitted.items)
      setFirstSubmittedAt(submitted.firstSubmittedAt)
    } finally {
      if (showSpinner) {
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    ensureClientKey()
  }, [])

  useEffect(() => {
    refreshAll(true)
  }, [localCartKey, sessionId, clientKey])

  const isSharedSession = Boolean(
    sessionId && !sessionId.startsWith("local:")
  )
  const mySubmittedItems = useMemo(
    () => submittedItems.filter(item => item.isMine),
    [submittedItems]
  )
  const myPendingItems = useMemo(
    () => cartItems.filter(item => item.isMine),
    [cartItems]
  )
  const otherPendingItems = useMemo(
    () => cartItems.filter(item => !item.isMine),
    [cartItems]
  )
  const otherSubmittedItems = useMemo(
    () => submittedItems.filter(item => !item.isMine),
    [submittedItems]
  )
  const myVisibleItems = useMemo(
    () => [...mySubmittedItems, ...myPendingItems],
    [mySubmittedItems, myPendingItems]
  )
  const sendDisabled =
    submitting ||
    cartItems.length === 0 ||
    (isSharedSession && !allMembersConfirmed)
  const totals = calculateCartTotals(myVisibleItems)

  async function submit() {
    if (cartItems.length === 0) return
    if (isSharedSession && !allMembersConfirmed) {
      setError(
        "Every member with pending items must confirm before sending the table order."
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
    }
    const queuedPayload = {
      ...payload,
      items: cartItems.map(i => ({
        itemId: i.id,
        menuItemId: i.menuItemId ?? undefined,
        name: i.name,
        quantity: i.quantity,
        edits: i.edits,
        allergens: i.allergens,
        unitPrice: i.unitPrice,
        station: i.station,
        vatRate: i.vatRate ?? 0,
      })),
    }

    if (activeClientKey) {
      payload.clientKey = activeClientKey
      queuedPayload.clientKey = activeClientKey
    }
    if (sessionId && !sessionId.startsWith("local:")) {
      payload.sessionId = sessionId
      queuedPayload.sessionId = sessionId
    } else {
      payload.items = queuedPayload.items
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
              : "Not sent yet. Waiting for all members to confirm their pending items."
          )
          await refreshAll(false)
          return
        }

        throw new Error(`${apiError} (HTTP ${res.status})`)
      }

      clearSubmittedItems()
      clearLocalCart()
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
      const isNetworkFailure =
        !navigator.onLine ||
        /failed to fetch|networkerror/i.test(message)

      if (isNetworkFailure) {
        queueOrderSubmission(queuedPayload)
      }

      setError(
        isNetworkFailure
          ? navigator.onLine
            ? `Order could not be submitted (${message}). Your items are still in your cart.`
            : "You are offline. Your items are still in your cart and can be submitted when connection returns."
          : `Order could not be submitted (${message}).`
      )
    } finally {
      setSubmitting(false)
      setShowConfirm(false)
    }
  }

  async function confirmMyPendingItems() {
    if (myPendingItems.length === 0 || !sessionId) return
    if (sessionId.startsWith("local:")) {
      setRequesterConfirmed(true)
      return
    }

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
        }),
      })

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}))
        throw new Error(payload?.error ?? "CONFIRMATION_FAILED")
      }

      const pending = await loadCartItems()
      applyPendingState(pending)
    } catch (confirmError: any) {
      setError(
        `Could not confirm your items (${confirmError?.message ?? "unknown"}).`
      )
    } finally {
      setConfirmingMine(false)
    }
  }

  const updateLocalCart = (
    itemId: string,
    updater: (item: ReviewItem) => ReviewItem | null
  ) => {
    const current = readLocalItems()
    const next = current
      .map(item => {
        if (item.id !== itemId) return item
        return updater(item)
      })
      .filter((item): item is ReviewItem => Boolean(item))
      .filter(item => item.quantity > 0)

    writeLocalItems(next)
    applyPendingState({
      items: next,
      members: [],
      requesterConfirmed: true,
      allMembersConfirmed: true,
      unconfirmedMemberCount: 0,
    })
  }

  async function setCartQty(item: ReviewItem, nextQty: number) {
    if (nextQty < 0 || !item.isMine) return

    setUpdatingCartItemId(item.id)
    setError(null)

    try {
      const activeClientKey = ensureClientKey()
      const canSync =
        Boolean(sessionId) &&
        !String(sessionId).startsWith("local:") &&
        !item.id.startsWith("local:")

      if (!canSync) {
        updateLocalCart(item.id, currentItem => {
          if (nextQty <= 0) return null
          return {
            ...currentItem,
            quantity: nextQty,
          }
        })
        return
      }

      const res = await fetch("/api/cart/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          itemId: item.id,
          quantity: nextQty,
          clientKey: activeClientKey,
        }),
      })

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}))
        throw new Error(payload?.error ?? "CART_ITEM_UPDATE_FAILED")
      }

      const pending = await loadCartItems()
      applyPendingState(pending)
    } catch (qtyError: any) {
      setError(
        `Could not update cart item (${qtyError?.message ?? "unknown"}).`
      )
    } finally {
      setUpdatingCartItemId(null)
    }
  }

  async function changeCartQty(item: ReviewItem, delta: 1 | -1) {
    await setCartQty(item, item.quantity + delta)
  }

  async function setSubmittedQty(item: ReviewItem, nextQty: number) {
    if (!item.orderItemId || nextQty < 0 || !item.isMine) return

    setUpdatingOrderItemId(item.orderItemId)
    setError(null)

    try {
      const activeClientKey = ensureClientKey()
      const body: {
        orderItemId: string
        quantity: number
        tagId: string
        clientKey?: string
        sessionId?: string
      } = {
        orderItemId: item.orderItemId,
        quantity: nextQty,
        tagId,
      }

      if (activeClientKey) {
        body.clientKey = activeClientKey
      }
      if (sessionId && !sessionId.startsWith("local:")) {
        body.sessionId = sessionId
      }

      const res = await fetch("/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}))
        throw new Error(payload?.error ?? "ORDER_ITEM_UPDATE_FAILED")
      }

      const submitted = await loadSubmittedItems()
      setSubmittedItems(submitted.items)
      setFirstSubmittedAt(submitted.firstSubmittedAt)
    } catch (qtyError: any) {
      setError(
        `Could not update ordered item (${qtyError?.message ?? "unknown"}).`
      )
    } finally {
      setUpdatingOrderItemId(null)
    }
  }

  async function changeSubmittedQty(
    item: ReviewItem,
    delta: 1 | -1
  ) {
    await setSubmittedQty(item, item.quantity + delta)
  }

  function openEdit(item: ReviewItem) {
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
        if (sessionId && !sessionId.startsWith("local:")) {
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
        setSubmittedItems(submitted.items)
        setFirstSubmittedAt(submitted.firstSubmittedAt)
      } else {
        if (!editingItem.isMine) {
          throw new Error("FORBIDDEN")
        }

        const canSync =
          Boolean(sessionId) &&
          !String(sessionId).startsWith("local:") &&
          !editingItem.id.startsWith("local:")

        if (canSync) {
          const res = await fetch("/api/cart/update", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sessionId,
              itemId: editingItem.id,
              edits: nextEdits,
              clientKey: activeClientKey,
            }),
          })

          if (!res.ok) {
            const payload = await res.json().catch(() => ({}))
            throw new Error(payload?.error ?? "CART_ITEM_EDIT_FAILED")
          }

          const pending = await loadCartItems()
          applyPendingState(pending)
        } else {
          updateLocalCart(editingItem.id, item => ({
            ...item,
            edits: nextEdits,
          }))
        }
      }

      setEditingItem(null)
      setEditDraft("")
    } catch (editError: any) {
      setError(
        `Could not update item edits (${editError?.message ?? "unknown"}).`
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
          Sent items are greyed out. Each member confirms first, then the table
          order can be sent.
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
              These stay in review until every member confirms.
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
                    {hasVisibleEdits(item.edits) && (
                      <div className="text-xs opacity-60">
                        {getEditNote(item.edits)
                          ? `Note: ${getEditNote(item.edits)}`
                          : "modified"}
                      </div>
                    )}
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
                        updatingCartItemId === item.id ||
                        submitting
                      }
                      onClick={() => changeCartQty(item, -1)}
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
                        updatingCartItemId === item.id ||
                        submitting
                      }
                      onClick={() => changeCartQty(item, 1)}
                    >
                      +
                    </button>
                    <button
                      type="button"
                      className="px-2 py-1 rounded border"
                      disabled={
                        updatingCartItemId === item.id ||
                        submitting
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

            {otherPendingItems.length > 0 && (
              <>
                <Divider />
                <div className="text-sm font-semibold mb-2">
                  Other members at your table ordered
                </div>
                <div className="text-xs opacity-70 mb-3">
                  These are pending too, but only they can edit and confirm them.
                </div>
                <div className="space-y-3">
                  {otherPendingItems.map(item => (
                    <div
                      key={item.id}
                      className="flex justify-between items-center gap-3 rounded border px-3 py-2 opacity-70"
                      style={{
                        background: "rgba(145, 158, 173, 0.16)",
                        borderColor: "rgba(110, 128, 145, 0.32)",
                      }}
                    >
                      <div>
                        <div className="font-medium">
                          {item.quantity}× {item.name}
                        </div>
                        {hasVisibleEdits(item.edits) && (
                          <div className="text-xs opacity-60">
                            {getEditNote(item.edits)
                              ? `Note: ${getEditNote(item.edits)}`
                              : "modified"}
                          </div>
                        )}
                      </div>
                      <div className="text-sm min-w-16 text-right">
                        £{(item.unitPrice * item.quantity).toFixed(2)}
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
                      ? "Your pending items are confirmed."
                      : "Confirm your items first."}
                  </div>
                  <Button
                    type="button"
                    variant={requesterConfirmed ? "secondary" : "primary"}
                    disabled={
                      confirmingMine ||
                      myPendingItems.length === 0 ||
                      requesterConfirmed
                    }
                    onClick={confirmMyPendingItems}
                  >
                    {requesterConfirmed ? "Confirmed" : "Confirm my items"}
                  </Button>
                </div>
              </>
            )}

            {isSharedSession && pendingMembers.length > 0 && (
              <div className="text-xs opacity-60 mt-2">
                {pendingMembers.filter(member => member.confirmed).length}/
                {pendingMembers.length} members confirmed
              </div>
            )}
          </Card>
        </>
      )}

      {mySubmittedItems.length > 0 && (
        <>
          <Divider />
          <Card>
            <div className="text-sm font-semibold mb-2">
              Your submitted additions
            </div>
            <div className="text-xs opacity-70 mb-3">
              Sent items are greyed to show they were already sent. You can still update your own.
            </div>
            <div className="space-y-3">
              {mySubmittedItems.map(item => (
                <div
                  key={item.id}
                  className="flex justify-between items-center gap-3 rounded border px-3 py-2"
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
                      {submittedStateLabel(item.status)}
                    </div>
                    {hasVisibleEdits(item.edits) && (
                      <div className="text-xs opacity-60">
                        {getEditNote(item.edits)
                          ? `Note: ${getEditNote(item.edits)}`
                          : "modified"}
                      </div>
                    )}
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
                        updatingOrderItemId === item.orderItemId
                      }
                      onClick={() => changeSubmittedQty(item, -1)}
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
                        updatingOrderItemId === item.orderItemId
                      }
                      onClick={() => changeSubmittedQty(item, 1)}
                    >
                      +
                    </button>
                    <button
                      type="button"
                      className="px-2 py-1 rounded border"
                      disabled={
                        updatingOrderItemId === item.orderItemId
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
            </div>
          </Card>
        </>
      )}

      {otherSubmittedItems.length > 0 && (
        <>
          <Divider />
          <Card>
            <div className="text-sm font-semibold mb-2">
              Other people&apos;s additions
            </div>
            <div className="text-xs opacity-70 mb-3">
              Sent by other devices. Read-only on your phone.
            </div>
            <div className="space-y-3">
              {otherSubmittedItems.map(item => (
                <div
                  key={item.id}
                  className="flex justify-between items-center gap-3 rounded border px-3 py-2 opacity-70"
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
                      {submittedStateLabel(item.status)}
                    </div>
                    {hasVisibleEdits(item.edits) && (
                      <div className="text-xs opacity-60">
                        {getEditNote(item.edits)
                          ? `Note: ${getEditNote(item.edits)}`
                          : "modified"}
                      </div>
                    )}
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
          Your totals
        </div>
        <div className="flex justify-between text-sm">
          <div>Subtotal</div>
          <div>£{totals.subtotal.toFixed(2)}</div>
        </div>
        <div className="flex justify-between text-sm opacity-70">
          <div>VAT</div>
          <div>£{totals.vat.toFixed(2)}</div>
        </div>
        <Divider />
        <div className="flex justify-between font-semibold">
          <div>Total</div>
          <div>£{totals.total.toFixed(2)}</div>
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
          {unconfirmedMemberCount === 1 ? "member" : "members"} to confirm
          their items.
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
