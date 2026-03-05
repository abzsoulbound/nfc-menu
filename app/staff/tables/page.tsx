"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { TableAssignment } from "@/components/staff/TableAssignment"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { Modal } from "@/components/ui/Modal"
import { fetchJson } from "@/lib/fetchJson"
import { useRealtimeSync } from "@/lib/useRealtimeSync"
import {
  TableBillDTO,
  TableDTO,
  TableReviewDTO,
  TagDTO,
} from "@/lib/types"

function minutesSince(ts: string) {
  return Math.floor(
    (Date.now() - new Date(ts).getTime()) / 60000
  )
}

function flattenReviewItems(review: TableReviewDTO | null) {
  if (!review) return []
  return [...review.initialOrders, ...review.addonOrders]
    .flatMap(order =>
      order.items.map(item => ({
        orderId: order.orderId,
        ...item,
      }))
    )
    .sort(
      (a, b) =>
        new Date(b.submittedAt).getTime() -
        new Date(a.submittedAt).getTime()
    )
}

export default function StaffTablesPage() {
  const [tables, setTables] = useState<TableDTO[]>([])
  const [tags, setTags] = useState<TagDTO[]>([])
  const [activeTableId, setActiveTableId] = useState<string | null>(
    null
  )
  const [tableSearch, setTableSearch] = useState("")
  const [tableReview, setTableReview] = useState<TableReviewDTO | null>(
    null
  )
  const [tableBill, setTableBill] = useState<TableBillDTO | null>(
    null
  )
  const [joinTargetTableId, setJoinTargetTableId] = useState("")
  const [splitCountInput, setSplitCountInput] = useState("1")
  const [paymentAmountInput, setPaymentAmountInput] = useState("")
  const [paymentMethodInput, setPaymentMethodInput] = useState("card")
  const [joinConfirm, setJoinConfirm] = useState<{
    sourceTableId: string
    targetTableId: string
  } | null>(null)
  const [confirmAction, setConfirmAction] = useState<{
    tableId: string
    action: "CLOSE_PAID" | "CLOSE_UNPAID"
    label: string
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busyKey, setBusyKey] = useState<string | null>(null)

  const fetchTables = useCallback(async () => {
    const data = await fetchJson<TableDTO[]>("/api/tables", {
      cache: "no-store",
    })
    setTables(data)
  }, [])

  const fetchTags = useCallback(async () => {
    const data = await fetchJson<TagDTO[]>("/api/tags", {
      cache: "no-store",
    })
    setTags(data)
  }, [])

  const activeTable = useMemo(
    () =>
      tables.find(t => t.id === activeTableId) ?? tables[0] ?? null,
    [tables, activeTableId]
  )

  const fetchActiveTableDetail = useCallback(async () => {
    if (!activeTable) {
      setTableReview(null)
      setTableBill(null)
      return
    }

    const [reviewResult, billResult] = await Promise.allSettled([
      fetchJson<TableReviewDTO>(
        `/api/orders?tableNumber=${activeTable.number}`,
        {
          cache: "no-store",
        }
      ),
      fetchJson<TableBillDTO>(
        `/api/staff?view=bill&tableId=${activeTable.id}`,
        {
          cache: "no-store",
        }
      ),
    ])

    if (reviewResult.status === "fulfilled") {
      setTableReview(reviewResult.value)
    }
    if (billResult.status === "fulfilled") {
      setTableBill(billResult.value)
      setSplitCountInput(String(billResult.value.splitCount))
    }
  }, [activeTable])

  useEffect(() => {
    fetchTables().catch(() => {})
    fetchTags().catch(() => {})
    const interval = setInterval(() => {
      fetchTables().catch(() => {})
      fetchTags().catch(() => {})
      fetchActiveTableDetail().catch(() => {})
    }, 5000)
    return () => clearInterval(interval)
  }, [fetchTables, fetchTags, fetchActiveTableDetail])

  useEffect(() => {
    fetchActiveTableDetail().catch(() => {})
  }, [fetchActiveTableDetail])

  useRealtimeSync(() => {
    fetchTables().catch(() => {})
    fetchTags().catch(() => {})
    fetchActiveTableDetail().catch(() => {})
  })

  const availableJoinTargets = useMemo(() => {
    if (!activeTable) return []
    return tables.filter(
      table => table.id !== activeTable.id && !table.closed
    )
  }, [tables, activeTable])

  const filteredTables = useMemo(() => {
    const query = tableSearch.trim().toLowerCase()
    if (!query) return tables

    return tables.filter(table => {
      const haystack = [
        `table ${table.number}`,
        table.billStatus ?? "",
        table.closed ? "closed" : "open",
        table.locked ? "locked" : "",
        table.stale ? "stale" : "",
      ]
        .join(" ")
        .toLowerCase()
      return haystack.includes(query)
    })
  }, [tableSearch, tables])

  const openTableCount = tables.filter(table => !table.closed).length
  const closedTableCount = tables.filter(table => table.closed).length
  const lockedTableCount = tables.filter(
    table => table.locked && !table.closed
  ).length
  const staleTableCount = tables.filter(
    table => table.stale && !table.closed
  ).length

  useEffect(() => {
    setJoinTargetTableId(prev => {
      if (
        prev &&
        availableJoinTargets.some(table => table.id === prev)
      ) {
        return prev
      }
      return availableJoinTargets[0]?.id ?? ""
    })
  }, [availableJoinTargets])

  async function lockTable(tableId: string, lock: boolean) {
    const action = lock ? "LOCK_TABLE" : "UNLOCK_TABLE"
    setBusyKey(`${action}:${tableId}`)
    setError(null)
    try {
      await fetchJson("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          tableId,
        }),
      })
      await Promise.all([
        fetchTables(),
        fetchTags(),
        fetchActiveTableDetail(),
      ])
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusyKey(null)
    }
  }

  async function closeTable(
    tableId: string,
    action: "CLOSE_PAID" | "CLOSE_UNPAID"
  ) {
    setBusyKey(`${action}:${tableId}`)
    setError(null)
    try {
      await fetchJson("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          tableId,
        }),
      })
      setConfirmAction(null)
      await Promise.all([
        fetchTables(),
        fetchTags(),
        fetchActiveTableDetail(),
      ])
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusyKey(null)
    }
  }

  async function joinTables(
    sourceTableId: string,
    targetTableId: string
  ) {
    const key = `MERGE_TABLE:${sourceTableId}:${targetTableId}`
    setBusyKey(key)
    setError(null)
    try {
      await fetchJson("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "MERGE_TABLE",
          sourceTableId,
          targetTableId,
        }),
      })
      setJoinConfirm(null)
      setActiveTableId(targetTableId)
      await Promise.all([
        fetchTables(),
        fetchTags(),
        fetchActiveTableDetail(),
      ])
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusyKey(null)
    }
  }

  async function runBillAction(payload: Record<string, unknown>) {
    const key = `bill:${String(payload.action)}`
    setBusyKey(key)
    setError(null)
    try {
      await fetchJson("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      await Promise.all([fetchTables(), fetchActiveTableDetail()])
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusyKey(null)
    }
  }

  async function runLineAction(
    action: "VOID_LINE" | "COMP_LINE" | "REFIRE_LINE",
    lineId: string
  ) {
    const reason = window.prompt(`${action.replace("_", " ")} reason`)
    if (!reason || reason.trim() === "") return

    const key = `${action}:${lineId}`
    setBusyKey(key)
    setError(null)
    try {
      await fetchJson("/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          lineId,
          reason: reason.trim(),
        }),
      })
      await fetchActiveTableDetail()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusyKey(null)
    }
  }

  const lineItems = useMemo(
    () => flattenReviewItems(tableReview),
    [tableReview]
  )

  return (
    <div className="relative px-4 py-5 md:px-6 md:py-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-12 top-16 h-44 w-44 rounded-full bg-[radial-gradient(circle,rgba(96,138,214,0.22),rgba(96,138,214,0))] blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 top-52 h-48 w-48 rounded-full bg-[radial-gradient(circle,rgba(103,162,236,0.2),rgba(103,162,236,0))] blur-3xl"
      />

      <div className="mx-auto max-w-[1440px] space-y-4">
        <Card
          variant="elevated"
          className="border-[rgba(111,147,213,0.4)] bg-[linear-gradient(132deg,rgba(15,28,50,0.96),rgba(21,39,66,0.94),rgba(29,52,85,0.92))]"
        >
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div className="space-y-2">
              <div className="text-[10px] uppercase tracking-[0.18em] text-[rgba(184,205,244,0.82)]">
                Table Operations
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-[#eef4ff] md:text-4xl">
                Live floor control
              </h1>
              <p className="max-w-3xl text-sm leading-6 text-[rgba(197,214,244,0.86)]">
                Manage table state, joins, billing, and line controls from a
                single waiter command workspace.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="status-chip status-chip-neutral">
                  Open: {openTableCount}
                </span>
                <span className="status-chip status-chip-neutral">
                  Closed: {closedTableCount}
                </span>
                <span className="status-chip status-chip-warning">
                  Locked: {lockedTableCount}
                </span>
                <span className="status-chip status-chip-warning">
                  Stale: {staleTableCount}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="quiet"
                className="min-h-[44px]"
                onClick={() => {
                  fetchTables().catch(() => {})
                  fetchTags().catch(() => {})
                  fetchActiveTableDetail().catch(() => {})
                }}
              >
                Refresh data
              </Button>
            </div>
          </div>
        </Card>

        {error && (
          <div className="status-chip status-chip-danger inline-flex">
            {error}
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-[1fr_1.25fr]">
          <Card className="space-y-3 border-[rgba(114,153,225,0.34)]">
            <div className="space-y-2">
              <h2 className="text-lg font-semibold tracking-tight">
                Tables
              </h2>
              <label className="space-y-1 text-xs uppercase tracking-[0.12em] text-muted">
                Search tables
                <input
                  type="text"
                  value={tableSearch}
                  onChange={event => setTableSearch(event.target.value)}
                  placeholder="number, status, locked, stale"
                  className="w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
                />
              </label>
            </div>

            <div className="space-y-2">
              {filteredTables.map(table => (
                <button
                  key={table.id}
                  type="button"
                  onClick={() => setActiveTableId(table.id)}
                  className={`focus-ring w-full rounded-[var(--radius-control)] border border-[var(--border)] p-3 text-left transition-all ${
                    activeTable?.id === table.id
                      ? "surface-accent"
                      : "surface-secondary"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-base font-semibold">
                        Table {table.number}
                      </div>
                      <div className="text-xs text-secondary">
                        Open {minutesSince(table.openedAt)}m ago
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {table.locked && (
                        <Badge variant="warning">Locked</Badge>
                      )}
                      {table.stale && (
                        <Badge variant="warning">Stale</Badge>
                      )}
                      {table.billStatus === "PARTIAL" && (
                        <Badge variant="warning">Partial</Badge>
                      )}
                      {table.closed && (
                        <Badge
                          variant={table.paid ? "success" : "danger"}
                        >
                          {table.paid ? "Paid" : "Unpaid"}
                        </Badge>
                      )}
                    </div>
                  </div>
                </button>
              ))}

              {filteredTables.length === 0 && (
                <div className="py-8 text-center text-sm text-secondary">
                  No matching tables.
                </div>
              )}
            </div>
          </Card>

          <Card className="space-y-4 border-[rgba(114,153,225,0.34)]">
            {!activeTable ? (
              <div className="py-10 text-center text-sm text-secondary">
                No tables available.
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-semibold tracking-tight">
                      Table {activeTable.number}
                    </h2>
                    <div className="text-sm text-secondary">
                      Open {minutesSince(activeTable.openedAt)}m ago
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {activeTable.locked && (
                      <Badge variant="warning">Locked</Badge>
                    )}
                    {activeTable.stale && (
                      <Badge variant="warning">Stale</Badge>
                    )}
                    {activeTable.billStatus && (
                      <Badge variant="neutral">
                        Bill {activeTable.billStatus.toLowerCase()}
                      </Badge>
                    )}
                    {activeTable.closed && (
                      <Badge
                        variant={
                          activeTable.paid ? "success" : "danger"
                        }
                      >
                        {activeTable.paid
                          ? "Closed paid"
                          : "Closed unpaid"}
                      </Badge>
                    )}
                  </div>
                </div>

                <TableAssignment
                  tableId={activeTable.id}
                  tableNumber={activeTable.number}
                  tags={tags.filter(
                    t => t.tableNumber === activeTable.number
                  )}
                  allTags={tags}
                  onChange={fetchTags}
                />

                <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                  <Button
                    variant={activeTable.locked ? "primary" : "quiet"}
                    className="min-h-[52px]"
                    disabled={busyKey !== null}
                    onClick={() =>
                      lockTable(
                        activeTable.id,
                        !activeTable.locked
                      ).catch(() => {})
                    }
                  >
                    {activeTable.locked
                      ? "Unlock table"
                      : "Lock table"}
                  </Button>

                  <Button
                    variant="danger"
                    className="min-h-[52px]"
                    disabled={busyKey !== null}
                    onClick={() =>
                      setConfirmAction({
                        tableId: activeTable.id,
                        action: "CLOSE_PAID",
                        label: "Close as paid",
                      })
                    }
                  >
                    Close as paid
                  </Button>

                  <Button
                    variant="danger"
                    className="min-h-[52px]"
                    disabled={busyKey !== null}
                    onClick={() =>
                      setConfirmAction({
                        tableId: activeTable.id,
                        action: "CLOSE_UNPAID",
                        label: "Close as unpaid",
                      })
                    }
                  >
                    Close as unpaid
                  </Button>
                </div>

                <Card variant="accent" className="space-y-3">
                  <div>
                    <h3 className="text-base font-semibold tracking-tight">
                      Join Tables
                    </h3>
                    <p className="text-xs text-secondary">
                      Merge this table into another open table.
                    </p>
                  </div>

                  {availableJoinTargets.length === 0 ? (
                    <div className="text-sm text-secondary">
                      No eligible target table available.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto]">
                      <select
                        value={joinTargetTableId}
                        onChange={event =>
                          setJoinTargetTableId(event.target.value)
                        }
                        className="min-h-[52px] rounded-[var(--radius-control)] border border-[var(--border)] bg-transparent px-3 text-sm"
                      >
                        {availableJoinTargets.map(table => (
                          <option key={table.id} value={table.id}>
                            Table {table.number}
                          </option>
                        ))}
                      </select>
                      <Button
                        variant="secondary"
                        className="min-h-[52px]"
                        disabled={
                          busyKey !== null ||
                          !joinTargetTableId ||
                          joinTargetTableId === activeTable.id
                        }
                        onClick={() =>
                          setJoinConfirm({
                            sourceTableId: activeTable.id,
                            targetTableId: joinTargetTableId,
                          })
                        }
                      >
                        Join now
                      </Button>
                    </div>
                  )}
                </Card>

                <Card variant="accent" className="space-y-3">
                  <h3 className="text-base font-semibold tracking-tight">
                    Billing
                  </h3>

                  {tableBill ? (
                    <>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="rounded-[var(--radius-control)] border border-[var(--border)] px-3 py-2">
                          Total: £{tableBill.total.toFixed(2)}
                        </div>
                        <div className="rounded-[var(--radius-control)] border border-[var(--border)] px-3 py-2">
                          Due: £{tableBill.dueTotal.toFixed(2)}
                        </div>
                        <div className="rounded-[var(--radius-control)] border border-[var(--border)] px-3 py-2">
                          Paid: £{tableBill.paidTotal.toFixed(2)}
                        </div>
                        <div className="rounded-[var(--radius-control)] border border-[var(--border)] px-3 py-2">
                          Split: {tableBill.splitCount}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                        <Button
                          variant="quiet"
                          className="min-h-[44px]"
                          disabled={busyKey !== null}
                          onClick={() =>
                            runBillAction({
                              action: "OPEN_BILL",
                              tableId: activeTable.id,
                            }).catch(() => {})
                          }
                        >
                          Open bill
                        </Button>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={1}
                            value={splitCountInput}
                            onChange={event =>
                              setSplitCountInput(event.target.value)
                            }
                            className="min-h-[44px] w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-transparent px-3 text-sm"
                          />
                          <Button
                            variant="secondary"
                            className="min-h-[44px]"
                            disabled={busyKey !== null}
                            onClick={() =>
                              runBillAction({
                                action: "SPLIT_BILL",
                                tableId: activeTable.id,
                                splitCount: Number(splitCountInput || "1"),
                              }).catch(() => {})
                            }
                          >
                            Split
                          </Button>
                        </div>
                        <Button
                          variant="danger"
                          className="min-h-[44px]"
                          disabled={busyKey !== null}
                          onClick={() =>
                            runBillAction({
                              action: "MARK_BILL_STATUS",
                              tableId: activeTable.id,
                              billStatus: "UNPAID",
                            }).catch(() => {})
                          }
                        >
                          Mark unpaid
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_1fr_auto]">
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={paymentAmountInput}
                          onChange={event =>
                            setPaymentAmountInput(event.target.value)
                          }
                          placeholder="Payment amount"
                          className="min-h-[44px] rounded-[var(--radius-control)] border border-[var(--border)] bg-transparent px-3 text-sm"
                        />
                        <select
                          value={paymentMethodInput}
                          onChange={event =>
                            setPaymentMethodInput(event.target.value)
                          }
                          className="min-h-[44px] rounded-[var(--radius-control)] border border-[var(--border)] bg-transparent px-3 text-sm"
                        >
                          <option value="card">Card</option>
                          <option value="cash">Cash</option>
                          <option value="mixed">Mixed</option>
                        </select>
                        <Button
                          variant="primary"
                          className="min-h-[44px]"
                          disabled={busyKey !== null}
                          onClick={() =>
                            runBillAction({
                              action: "ADD_PAYMENT",
                              tableId: activeTable.id,
                              amount: Number(paymentAmountInput || "0"),
                              method: paymentMethodInput,
                            }).catch(() => {})
                          }
                        >
                          Add payment
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="text-sm text-secondary">
                      Billing unavailable.
                    </div>
                  )}
                </Card>

                <Card variant="accent" className="space-y-2">
                  <h3 className="text-base font-semibold tracking-tight">
                    Order Line Controls
                  </h3>
                  <div className="max-h-[260px] space-y-2 overflow-y-auto pr-1">
                    {lineItems.map(line => (
                      <div
                        key={line.lineId}
                        className="rounded-[var(--radius-control)] border border-[var(--border)] surface-secondary p-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-sm font-semibold">
                            {line.quantity} x {line.name}
                          </div>
                          <div className="flex gap-1">
                            {line.voidedAt && (
                              <Badge variant="danger">Voided</Badge>
                            )}
                            {line.compedAt && (
                              <Badge variant="warning">Comped</Badge>
                            )}
                          </div>
                        </div>
                        <div className="mt-2 grid grid-cols-3 gap-1">
                          <Button
                            variant="danger"
                            className="min-h-[36px] text-xs"
                            disabled={busyKey !== null || !!line.voidedAt}
                            onClick={() =>
                              runLineAction("VOID_LINE", line.lineId).catch(
                                () => {}
                              )
                            }
                          >
                            Void
                          </Button>
                          <Button
                            variant="secondary"
                            className="min-h-[36px] text-xs"
                            disabled={busyKey !== null || !!line.compedAt}
                            onClick={() =>
                              runLineAction("COMP_LINE", line.lineId).catch(
                                () => {}
                              )
                            }
                          >
                            Comp
                          </Button>
                          <Button
                            variant="ghost"
                            className="min-h-[36px] text-xs"
                            disabled={busyKey !== null}
                            onClick={() =>
                              runLineAction(
                                "REFIRE_LINE",
                                line.lineId
                              ).catch(() => {})
                            }
                          >
                            Refire
                          </Button>
                        </div>
                      </div>
                    ))}

                    {lineItems.length === 0 && (
                      <div className="text-sm text-secondary">
                        No order lines yet.
                      </div>
                    )}
                  </div>
                </Card>
              </>
            )}
          </Card>
        </div>
      </div>

      {confirmAction && (
        <Modal
          title="Confirm table close"
          onCancel={() => setConfirmAction(null)}
          onConfirm={() =>
            closeTable(
              confirmAction.tableId,
              confirmAction.action
            ).catch(() => {})
          }
          confirmLabel={confirmAction.label}
          confirmDisabled={busyKey !== null}
        >
          This action closes the table and updates operational status.
        </Modal>
      )}

      {joinConfirm && (
        <Modal
          title="Confirm table join"
          onCancel={() => setJoinConfirm(null)}
          onConfirm={() =>
            joinTables(
              joinConfirm.sourceTableId,
              joinConfirm.targetTableId
            ).catch(() => {})
          }
          confirmLabel="Join tables"
          confirmDisabled={busyKey !== null}
        >
          Merge the selected source table into target table.
        </Modal>
      )}
    </div>
  )
}
