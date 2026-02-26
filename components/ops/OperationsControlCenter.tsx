"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { Modal } from "@/components/ui/Modal"
import { fetchJson } from "@/lib/fetchJson"
import { useRealtimeSync } from "@/lib/useRealtimeSync"
import {
  AuditEventDTO,
  MenuSection,
  OrderQueueItemDTO,
  PrintJobDTO,
  ReadyQueueItemDTO,
  SessionDTO,
  ShiftReportDTO,
  TableDTO,
  TagDTO,
} from "@/lib/types"

type StaffAction =
  | "LOCK_TABLE"
  | "UNLOCK_TABLE"
  | "CLOSE_PAID"
  | "CLOSE_UNPAID"
  | "REOPEN_TABLE"
  | "RESET_TABLE_TIMER"
  | "SERVICE_LOCK"
  | "SERVICE_UNLOCK"
  | "RESET_RUNTIME"
  | "TRANSFER_TABLE"
  | "MERGE_TABLE"
  | "SPLIT_ADDONS"

type DashboardRole = "manager" | "admin"

type StaffActionPayload = {
  tableId?: string
  sourceTableId?: string
  targetTableId?: string
}

const MAX_ITEM_IMAGE_UPLOAD_BYTES = 1_800_000

function minutesSince(ts: string) {
  return Math.floor((Date.now() - new Date(ts).getTime()) / 60000)
}

function tableStatus(table: TableDTO) {
  if (table.closed) {
    return table.paid ? "closed-paid" : "closed-unpaid"
  }
  if (table.locked) return "locked"
  if (table.stale) return "stale"
  return "open"
}

function formatCurrency(value: number) {
  return `£${value.toFixed(2)}`
}

function formatEventTime(ts: string) {
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result)
        return
      }
      reject(new Error("Could not read image file"))
    }
    reader.onerror = () => {
      reject(new Error("Could not read image file"))
    }
    reader.readAsDataURL(file)
  })
}

export function OperationsControlCenter({
  role,
}: {
  role: DashboardRole
}) {
  const [serviceLocked, setServiceLocked] = useState(false)
  const [tables, setTables] = useState<TableDTO[]>([])
  const [tags, setTags] = useState<TagDTO[]>([])
  const [sessions, setSessions] = useState<SessionDTO[]>([])
  const [readyQueue, setReadyQueue] = useState<ReadyQueueItemDTO[]>([])
  const [kitchenQueue, setKitchenQueue] = useState<OrderQueueItemDTO[]>([])
  const [barQueue, setBarQueue] = useState<OrderQueueItemDTO[]>([])
  const [menuSections, setMenuSections] = useState<MenuSection[]>([])
  const [shiftReport, setShiftReport] = useState<ShiftReportDTO | null>(null)
  const [auditTrail, setAuditTrail] = useState<AuditEventDTO[]>([])
  const [printJobs, setPrintJobs] = useState<PrintJobDTO[]>([])

  const [error, setError] = useState<string | null>(null)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [showResetRuntimeConfirm, setShowResetRuntimeConfirm] = useState(false)
  const [showMenuImportModal, setShowMenuImportModal] = useState(false)
  const [menuImportCsv, setMenuImportCsv] = useState("")

  const [sourceTableId, setSourceTableId] = useState<string>("")
  const [targetTableId, setTargetTableId] = useState<string>("")
  const [transferResult, setTransferResult] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    const [
      menuResult,
      tablesResult,
      tagsResult,
      sessionsResult,
      readyResult,
      kitchenResult,
      barResult,
      reportResult,
      auditResult,
      printResult,
    ] = await Promise.allSettled([
      fetchJson<{ menu: MenuSection[]; locked: boolean }>("/api/menu?view=ops", {
        cache: "no-store",
      }),
      fetchJson<TableDTO[]>("/api/tables", {
        cache: "no-store",
      }),
      fetchJson<TagDTO[]>("/api/tags", {
        cache: "no-store",
      }),
      fetchJson<SessionDTO[]>("/api/sessions", {
        cache: "no-store",
      }),
      fetchJson<ReadyQueueItemDTO[]>("/api/orders?view=ready", {
        cache: "no-store",
      }),
      fetchJson<OrderQueueItemDTO[]>("/api/orders?station=KITCHEN", {
        cache: "no-store",
      }),
      fetchJson<OrderQueueItemDTO[]>("/api/orders?station=BAR", {
        cache: "no-store",
      }),
      fetchJson<ShiftReportDTO>("/api/staff?view=report", {
        cache: "no-store",
      }),
      fetchJson<AuditEventDTO[]>("/api/staff?view=audit&limit=40", {
        cache: "no-store",
      }),
      fetchJson<PrintJobDTO[]>("/api/staff?view=prints", {
        cache: "no-store",
      }),
    ])

    if (menuResult.status === "fulfilled") {
      setServiceLocked(menuResult.value.locked)
      setMenuSections(menuResult.value.menu)
    }
    if (tablesResult.status === "fulfilled") {
      setTables(tablesResult.value)
    }
    if (tagsResult.status === "fulfilled") {
      setTags(tagsResult.value)
    }
    if (sessionsResult.status === "fulfilled") {
      setSessions(sessionsResult.value)
    }
    if (readyResult.status === "fulfilled") {
      setReadyQueue(readyResult.value)
    }
    if (kitchenResult.status === "fulfilled") {
      setKitchenQueue(kitchenResult.value)
    }
    if (barResult.status === "fulfilled") {
      setBarQueue(barResult.value)
    }
    if (reportResult.status === "fulfilled") {
      setShiftReport(reportResult.value)
    }
    if (auditResult.status === "fulfilled") {
      setAuditTrail(auditResult.value)
    }
    if (printResult.status === "fulfilled") {
      setPrintJobs(printResult.value)
    }
  }, [])

  useEffect(() => {
    fetchAll().catch(err => setError((err as Error).message))
    const timer = setInterval(() => {
      fetchAll().catch(() => {})
    }, 5000)
    return () => clearInterval(timer)
  }, [fetchAll])

  useRealtimeSync(() => {
    fetchAll().catch(() => {})
  })

  useEffect(() => {
    if (tables.length === 0) {
      setSourceTableId("")
      setTargetTableId("")
      return
    }

    setSourceTableId(prev => {
      if (prev && tables.some(table => table.id === prev)) {
        return prev
      }
      return tables[0]?.id ?? ""
    })

    setTargetTableId(prev => {
      if (prev && tables.some(table => table.id === prev)) {
        return prev
      }
      return tables[1]?.id ?? tables[0]?.id ?? ""
    })
  }, [tables])

  const delayedItems = useMemo(() => {
    const kitchen = kitchenQueue.map(item => ({
      ...item,
      stationLabel: "Kitchen",
      age: minutesSince(item.submittedAt),
    }))
    const bar = barQueue.map(item => ({
      ...item,
      stationLabel: "Bar",
      age: minutesSince(item.submittedAt),
    }))

    return [...kitchen, ...bar]
      .filter(item => item.age > 10)
      .sort((a, b) => b.age - a.age)
  }, [kitchenQueue, barQueue])

  const closedTables = useMemo(
    () => tables.filter(table => table.closed),
    [tables]
  )

  const menuItemRows = useMemo(() => {
    return menuSections.flatMap(section =>
      section.items.map(item => ({
        sectionId: section.id,
        sectionName: section.name,
        ...item,
      }))
    )
  }, [menuSections])

  const activeMenuCount = useMemo(
    () => menuItemRows.filter(item => item.active !== false).length,
    [menuItemRows]
  )

  async function applyAction(
    action: StaffAction,
    payload: StaffActionPayload = {}
  ) {
    const key = payload.tableId
      ? `${action}:${payload.tableId}`
      : payload.sourceTableId && payload.targetTableId
      ? `${action}:${payload.sourceTableId}:${payload.targetTableId}`
      : action

    setBusyKey(key)
    setError(null)
    setTransferResult(null)

    try {
      const result = await fetchJson<{
        movedOrders?: number
        sourceTableNumber?: number
        targetTableNumber?: number
        mode?: string
      }>("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          ...payload,
        }),
      })

      if (action === "RESET_RUNTIME") {
        setShowResetRuntimeConfirm(false)
      }

      if (
        action === "TRANSFER_TABLE" ||
        action === "MERGE_TABLE" ||
        action === "SPLIT_ADDONS"
      ) {
        if (
          typeof result.movedOrders === "number" &&
          typeof result.sourceTableNumber === "number" &&
          typeof result.targetTableNumber === "number"
        ) {
          setTransferResult(
            `${result.movedOrders} order group(s) moved from table ${result.sourceTableNumber} to table ${result.targetTableNumber}.`
          )
        }
      }

      await fetchAll()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusyKey(null)
    }
  }

  async function setMenuItemActive(itemId: string, active: boolean) {
    const key = `menu:${itemId}`
    setBusyKey(key)
    setError(null)

    try {
      await fetchJson("/api/menu", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "SET_ITEM_ACTIVE",
          itemId,
          active,
        }),
      })
      await fetchAll()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusyKey(null)
    }
  }

  async function adjustMenuItemStock(itemId: string, delta: number) {
    const key = `stock:${itemId}:${delta}`
    setBusyKey(key)
    setError(null)

    try {
      await fetchJson("/api/menu", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ADJUST_ITEM_STOCK",
          itemId,
          delta,
        }),
      })
      await fetchAll()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusyKey(null)
    }
  }

  async function setMenuItemImageData(
    itemId: string,
    imageDataUrl: string | null
  ) {
    const key = `image:${itemId}`
    setBusyKey(key)
    setError(null)

    try {
      await fetchJson("/api/menu", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "SET_ITEM_IMAGE",
          itemId,
          imageDataUrl,
        }),
      })
      await fetchAll()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusyKey(null)
    }
  }

  async function uploadMenuItemImage(itemId: string, file: File) {
    if (!file.type.startsWith("image/")) {
      throw new Error("Please select an image file.")
    }

    if (file.size > MAX_ITEM_IMAGE_UPLOAD_BYTES) {
      throw new Error("Image too large. Keep files under 1.8MB.")
    }

    const imageDataUrl = await readFileAsDataUrl(file)
    await setMenuItemImageData(itemId, imageDataUrl)
  }

  async function importMenuFromCsv() {
    const key = "menu:import"
    setBusyKey(key)
    setError(null)

    try {
      await fetchJson("/api/menu", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "IMPORT_MENU_CSV",
          csv: menuImportCsv,
        }),
      })
      setMenuImportCsv("")
      setShowMenuImportModal(false)
      await fetchAll()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusyKey(null)
    }
  }

  async function retryPrintJob(jobId: string) {
    const key = `print:${jobId}`
    setBusyKey(key)
    setError(null)
    try {
      await fetchJson("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "PRINT_RETRY",
          printJobId: jobId,
        }),
      })
      await fetchAll()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusyKey(null)
    }
  }

  function downloadCsv(type: "orders" | "menu" | "audit") {
    window.open(`/api/staff?view=export&type=${type}`, "_blank", "noopener,noreferrer")
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="status-chip status-chip-danger inline-flex">
          {error}
        </div>
      )}
      {transferResult && (
        <div className="status-chip status-chip-success inline-flex">
          {transferResult}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-7">
        <Card variant="elevated">
          <div className="text-xs uppercase tracking-[0.14em] text-muted">
            Service
          </div>
          <div className="mt-1 text-xl font-semibold">
            {serviceLocked ? "Locked" : "Open"}
          </div>
        </Card>
        <Card variant="elevated">
          <div className="text-xs uppercase tracking-[0.14em] text-muted">
            Tables
          </div>
          <div className="mt-1 text-xl font-semibold">{tables.length}</div>
        </Card>
        <Card variant="elevated">
          <div className="text-xs uppercase tracking-[0.14em] text-muted">
            Closed tables
          </div>
          <div className="mt-1 text-xl font-semibold">{closedTables.length}</div>
        </Card>
        <Card variant="elevated">
          <div className="text-xs uppercase tracking-[0.14em] text-muted">
            Sessions
          </div>
          <div className="mt-1 text-xl font-semibold">{sessions.length}</div>
        </Card>
        <Card variant="elevated">
          <div className="text-xs uppercase tracking-[0.14em] text-muted">
            Ready queue
          </div>
          <div className="mt-1 text-xl font-semibold">{readyQueue.length}</div>
        </Card>
        <Card variant="elevated">
          <div className="text-xs uppercase tracking-[0.14em] text-muted">
            Unassigned tags
          </div>
          <div className="mt-1 text-xl font-semibold">
            {tags.filter(tag => tag.tableNumber === null).length}
          </div>
        </Card>
        <Card variant="elevated">
          <div className="text-xs uppercase tracking-[0.14em] text-muted">
            Revenue
          </div>
          <div className="mt-1 text-xl font-semibold">
            {formatCurrency(shiftReport?.totalRevenue ?? 0)}
          </div>
        </Card>
      </div>

      <Card className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold tracking-tight">Service Controls</h2>
          <Badge variant={serviceLocked ? "danger" : "success"}>
            {serviceLocked ? "Ordering locked" : "Ordering open"}
          </Badge>
        </div>

        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <Button
            variant="danger"
            className="min-h-[52px]"
            disabled={busyKey !== null || serviceLocked}
            onClick={() => applyAction("SERVICE_LOCK")}
          >
            Lock all customer ordering
          </Button>
          <Button
            variant="primary"
            className="min-h-[52px]"
            disabled={busyKey !== null || !serviceLocked}
            onClick={() => applyAction("SERVICE_UNLOCK")}
          >
            Unlock customer ordering
          </Button>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.25fr_1fr]">
        <Card className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">Table Interventions</h2>

          <div className="max-h-[560px] space-y-2 overflow-y-auto pr-1">
            {tables.map(table => (
              <Card key={table.id} variant="accent">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-base font-semibold">Table {table.number}</div>
                    <Badge
                      variant={
                        tableStatus(table) === "closed-unpaid"
                          ? "danger"
                          : tableStatus(table) === "closed-paid"
                          ? "success"
                          : tableStatus(table) === "locked" || tableStatus(table) === "stale"
                          ? "warning"
                          : "neutral"
                      }
                    >
                      {tableStatus(table).replace("-", " ")}
                    </Badge>
                  </div>

                  {table.closed ? (
                    <Button
                      variant="primary"
                      className="w-full min-h-[44px]"
                      disabled={busyKey === `REOPEN_TABLE:${table.id}`}
                      onClick={() => applyAction("REOPEN_TABLE", { tableId: table.id })}
                    >
                      Reopen table
                    </Button>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant={table.locked ? "primary" : "quiet"}
                        className="min-h-[44px]"
                        disabled={
                          busyKey ===
                          `${table.locked ? "UNLOCK_TABLE" : "LOCK_TABLE"}:${table.id}`
                        }
                        onClick={() =>
                          applyAction(table.locked ? "UNLOCK_TABLE" : "LOCK_TABLE", {
                            tableId: table.id,
                          })
                        }
                      >
                        {table.locked ? "Unlock" : "Lock"}
                      </Button>

                      <Button
                        variant="secondary"
                        className="min-h-[44px]"
                        disabled={busyKey === `RESET_TABLE_TIMER:${table.id}`}
                        onClick={() =>
                          applyAction("RESET_TABLE_TIMER", { tableId: table.id })
                        }
                      >
                        Reset timer
                      </Button>

                      <Button
                        variant="danger"
                        className="min-h-[44px]"
                        disabled={busyKey === `CLOSE_PAID:${table.id}`}
                        onClick={() => applyAction("CLOSE_PAID", { tableId: table.id })}
                      >
                        Close paid
                      </Button>

                      <Button
                        variant="danger"
                        className="min-h-[44px]"
                        disabled={busyKey === `CLOSE_UNPAID:${table.id}`}
                        onClick={() => applyAction("CLOSE_UNPAID", { tableId: table.id })}
                      >
                        Close unpaid
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="space-y-3">
            <h2 className="text-lg font-semibold tracking-tight">Table Transfer Tools</h2>
            <p className="text-sm text-secondary">
              Move all orders, merge full table history, or move only add-ons to another table.
            </p>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <label className="space-y-1 text-xs text-muted">
                Source table
                <select
                  value={sourceTableId}
                  onChange={event => setSourceTableId(event.target.value)}
                  className="min-h-[44px] w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-transparent px-3 text-sm text-[var(--text-primary)]"
                >
                  {tables.map(table => (
                    <option key={table.id} value={table.id}>
                      Table {table.number}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1 text-xs text-muted">
                Target table
                <select
                  value={targetTableId}
                  onChange={event => setTargetTableId(event.target.value)}
                  className="min-h-[44px] w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-transparent px-3 text-sm text-[var(--text-primary)]"
                >
                  {tables.map(table => (
                    <option key={table.id} value={table.id}>
                      Table {table.number}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
              <Button
                variant="secondary"
                className="min-h-[44px]"
                disabled={
                  !sourceTableId ||
                  !targetTableId ||
                  sourceTableId === targetTableId ||
                  busyKey !== null
                }
                onClick={() =>
                  applyAction("TRANSFER_TABLE", {
                    sourceTableId,
                    targetTableId,
                  })
                }
              >
                Transfer all
              </Button>
              <Button
                variant="quiet"
                className="min-h-[44px]"
                disabled={
                  !sourceTableId ||
                  !targetTableId ||
                  sourceTableId === targetTableId ||
                  busyKey !== null
                }
                onClick={() =>
                  applyAction("SPLIT_ADDONS", {
                    sourceTableId,
                    targetTableId,
                  })
                }
              >
                Move add-ons
              </Button>
              <Button
                variant="danger"
                className="min-h-[44px]"
                disabled={
                  !sourceTableId ||
                  !targetTableId ||
                  sourceTableId === targetTableId ||
                  busyKey !== null
                }
                onClick={() =>
                  applyAction("MERGE_TABLE", {
                    sourceTableId,
                    targetTableId,
                  })
                }
              >
                Merge and close source
              </Button>
            </div>
          </Card>

          <Card className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold tracking-tight">Shift Snapshot</h2>
              <Button
                variant="ghost"
                className="min-h-[40px]"
                onClick={() => downloadCsv("orders")}
              >
                Export orders CSV
              </Button>
            </div>
            {shiftReport ? (
              <div className="grid grid-cols-2 gap-2 text-sm">
                <Card variant="accent">
                  <div className="text-xs text-muted">Orders</div>
                  <div className="text-base font-semibold">{shiftReport.orders}</div>
                </Card>
                <Card variant="accent">
                  <div className="text-xs text-muted">Order lines</div>
                  <div className="text-base font-semibold">{shiftReport.orderLines}</div>
                </Card>
                <Card variant="accent">
                  <div className="text-xs text-muted">VAT</div>
                  <div className="text-base font-semibold">
                    {formatCurrency(shiftReport.totalVat)}
                  </div>
                </Card>
                <Card variant="accent">
                  <div className="text-xs text-muted">Avg prep</div>
                  <div className="text-base font-semibold">
                    {shiftReport.performance.avgPrepMinutes.toFixed(1)}m
                  </div>
                </Card>
                <Card variant="accent">
                  <div className="text-xs text-muted">Ready to delivered</div>
                  <div className="text-base font-semibold">
                    {shiftReport.performance.avgReadyToDeliveredMinutes.toFixed(1)}m
                  </div>
                </Card>
                <Card variant="accent">
                  <div className="text-xs text-muted">Delayed active lines</div>
                  <div className="text-base font-semibold">
                    {shiftReport.performance.delayedActiveLines}
                  </div>
                </Card>
              </div>
            ) : (
              <div className="py-4 text-sm text-secondary">Shift report unavailable.</div>
            )}
          </Card>

          <Card className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold tracking-tight">Delayed Tickets</h2>
              <Badge variant={delayedItems.length > 0 ? "danger" : "success"}>
                {delayedItems.length}
              </Badge>
            </div>

            <div className="max-h-[260px] space-y-2 overflow-y-auto pr-1">
              {delayedItems.slice(0, 20).map((item, index) => (
                <Card key={`${item.orderId}-${item.name}-${index}`} variant="accent">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-semibold">
                        {item.tableNumber === 0 ? "Takeaway" : `Table ${item.tableNumber}`}
                      </div>
                      <Badge variant="danger">{item.age}m</Badge>
                    </div>
                    <div className="text-xs text-secondary">
                      {item.stationLabel} | {item.quantity} x {item.name}
                    </div>
                  </div>
                </Card>
              ))}

              {delayedItems.length === 0 && (
                <div className="py-6 text-center text-sm text-secondary">No delayed tickets.</div>
              )}
            </div>
          </Card>

          <Card className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold tracking-tight">
                Printer Queue
              </h2>
              <Badge
                variant={
                  printJobs.some(job => job.status === "FAILED")
                    ? "danger"
                    : "neutral"
                }
              >
                {printJobs.length}
              </Badge>
            </div>
            <div className="max-h-[220px] space-y-2 overflow-y-auto pr-1">
              {printJobs.slice(0, 20).map(job => (
                <Card key={job.id} variant="accent">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs">
                      <div className="font-semibold">
                        {job.station} |{" "}
                        {job.tableNumber === 0
                          ? "Takeaway"
                          : `Table ${job.tableNumber}`}
                      </div>
                      <div className="text-secondary">
                        {job.reason} | attempts {job.attempts}
                      </div>
                    </div>
                    {job.status === "FAILED" ? (
                      <Button
                        variant="danger"
                        className="min-h-[34px] px-2 text-xs"
                        disabled={busyKey !== null}
                        onClick={() => retryPrintJob(job.id).catch(() => {})}
                      >
                        Retry
                      </Button>
                    ) : (
                      <Badge
                        variant={
                          job.status === "PRINTED"
                            ? "success"
                            : "warning"
                        }
                      >
                        {job.status.toLowerCase()}
                      </Badge>
                    )}
                  </div>
                </Card>
              ))}
              {printJobs.length === 0 && (
                <div className="py-4 text-sm text-secondary">
                  No print jobs.
                </div>
              )}
            </div>
          </Card>

          <Card className="space-y-2">
            <h3 className="text-base font-semibold tracking-tight">Operational Shortcuts</h3>
            <div className="grid grid-cols-2 gap-2">
              <Link
                href="/waiter"
                className="focus-ring inline-flex min-h-[44px] items-center justify-center rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--accent-quiet)] px-3 text-sm font-semibold"
              >
                Waiter
              </Link>
              <Link
                href="/waiter/tags"
                className="focus-ring inline-flex min-h-[44px] items-center justify-center rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--accent-quiet)] px-3 text-sm font-semibold"
              >
                Tags
              </Link>
              <Link
                href="/kitchen"
                className="focus-ring inline-flex min-h-[44px] items-center justify-center rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--accent-quiet)] px-3 text-sm font-semibold"
              >
                Kitchen
              </Link>
              <Link
                href="/bar"
                className="focus-ring inline-flex min-h-[44px] items-center justify-center rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--accent-quiet)] px-3 text-sm font-semibold"
              >
                Bar
              </Link>
              <Link
                href="/manager/features"
                className="focus-ring inline-flex min-h-[44px] items-center justify-center rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--accent-quiet)] px-3 text-sm font-semibold"
              >
                Growth
              </Link>
            </div>
          </Card>

          {role === "admin" && (
            <Card className="space-y-3 border-[var(--danger-fg)]">
              <h3 className="text-base font-semibold tracking-tight">Admin Emergency Controls</h3>
              <div className="grid grid-cols-1 gap-2">
                <Button
                  variant="ghost"
                  className="min-h-[44px]"
                  onClick={() => downloadCsv("audit")}
                >
                  Export audit CSV
                </Button>
              </div>
              <Button
                variant="danger"
                className="w-full min-h-[52px]"
                disabled={busyKey === "RESET_RUNTIME"}
                onClick={() => setShowResetRuntimeConfirm(true)}
              >
                Reset runtime state
              </Button>
              <p className="text-xs text-secondary">
                Clears sessions, orders, tags, and table state back to fresh defaults.
              </p>
            </Card>
          )}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.25fr_1fr]">
        <Card className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold tracking-tight">Menu Availability Board</h2>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="ghost"
                className="min-h-[38px]"
                onClick={() => downloadCsv("menu")}
              >
                Export menu CSV
              </Button>
              <Button
                variant="ghost"
                className="min-h-[38px]"
                disabled={busyKey !== null}
                onClick={() => setShowMenuImportModal(true)}
              >
                Import replacement CSV
              </Button>
              <Badge variant="neutral">
                {activeMenuCount}/{menuItemRows.length} available
              </Badge>
            </div>
          </div>

          <div className="max-h-[520px] space-y-3 overflow-y-auto pr-1">
            {menuSections.map(section => (
              <Card key={section.id} variant="accent" className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                  {section.name}
                </div>
                <div className="space-y-2">
                  {section.items.map(item => {
                    const active = item.active !== false
                    const hasFiniteStock =
                      typeof item.stockCount === "number"
                    const hasCustomImage =
                      typeof item.image === "string" &&
                      item.image.trim() !== ""
                    const imageBusy = busyKey === `image:${item.id}`
                    return (
                      <div
                        key={item.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-control)] border border-[var(--border)] surface-secondary px-3 py-2"
                      >
                        <div>
                          <div className="text-sm font-semibold">{item.name}</div>
                          <div className="text-xs text-secondary">
                            {item.station} | £{item.basePrice.toFixed(2)} | stock{" "}
                            {typeof item.stockCount === "number"
                              ? item.stockCount
                              : "unlimited"}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <div className="flex items-center gap-1">
                            <Button
                              variant="quiet"
                              className="min-h-[38px] px-2 text-xs"
                              disabled={
                                busyKey !== null || !hasFiniteStock
                              }
                              onClick={() =>
                                adjustMenuItemStock(item.id, -1).catch(
                                  () => {}
                                )
                              }
                            >
                              -1
                            </Button>
                            <Button
                              variant="quiet"
                              className="min-h-[38px] px-2 text-xs"
                              disabled={
                                busyKey !== null || !hasFiniteStock
                              }
                              onClick={() =>
                                adjustMenuItemStock(item.id, 1).catch(
                                  () => {}
                                )
                              }
                            >
                              +1
                            </Button>
                            <Button
                              variant={active ? "quiet" : "danger"}
                              className="min-h-[38px]"
                              disabled={busyKey === `menu:${item.id}`}
                              onClick={() =>
                                setMenuItemActive(item.id, !active)
                              }
                            >
                              {active ? "Set unavailable" : "Restore item"}
                            </Button>
                          </div>
                          <div className="flex flex-wrap items-center justify-end gap-1">
                            <label
                              className={`focus-ring inline-flex min-h-[34px] items-center justify-center rounded-[var(--radius-control)] border border-[var(--border)] px-2 text-xs font-semibold ${
                                busyKey !== null
                                  ? "cursor-not-allowed opacity-60"
                                  : "cursor-pointer"
                              }`}
                            >
                              {imageBusy ? "Uploading..." : "Upload image"}
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                disabled={busyKey !== null}
                                onChange={event => {
                                  const file = event.target.files?.[0] ?? null
                                  event.currentTarget.value = ""
                                  if (!file) return
                                  uploadMenuItemImage(item.id, file).catch(
                                    err => setError((err as Error).message)
                                  )
                                }}
                              />
                            </label>
                            <Button
                              variant="quiet"
                              className="min-h-[34px] px-2 text-xs"
                              disabled={busyKey !== null || !hasCustomImage}
                              onClick={() =>
                                setMenuItemImageData(item.id, null).catch(
                                  () => {}
                                )
                              }
                            >
                              Clear image
                            </Button>
                          </div>
                          <div className="text-[11px] text-secondary">
                            {hasCustomImage
                              ? "Image: manager upload"
                              : "Image: AI generated (base failsafe active)"}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </Card>
            ))}
          </div>
        </Card>

        <Card className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold tracking-tight">Audit Trail</h2>
            <Badge variant="neutral">{auditTrail.length}</Badge>
          </div>
          <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
            {auditTrail.map(event => (
              <Card key={event.id} variant="accent">
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-xs text-muted">
                    <span>{formatEventTime(event.createdAt)}</span>
                    <span>{event.actorRole}</span>
                  </div>
                  <div className="text-sm font-semibold">{event.action}</div>
                  <div className="text-xs text-secondary">
                    {event.targetType} | {event.targetId}
                  </div>
                  {event.note && <div className="text-xs text-secondary">{event.note}</div>}
                </div>
              </Card>
            ))}

            {auditTrail.length === 0 && (
              <div className="py-6 text-center text-sm text-secondary">No audit events yet.</div>
            )}
          </div>
        </Card>
      </div>

      {showMenuImportModal && (
        <Modal
          title="Import replacement menu CSV"
          onCancel={() => setShowMenuImportModal(false)}
          onConfirm={() => {
            importMenuFromCsv().catch(() => {})
          }}
          confirmLabel={
            busyKey === "menu:import" ? "Importing..." : "Import menu"
          }
          confirmDisabled={
            busyKey !== null || menuImportCsv.trim() === ""
          }
        >
          <div className="space-y-2">
            <p>
              Paste CSV exported from this board, edit rows, then import to replace the full menu.
            </p>
            <textarea
              value={menuImportCsv}
              onChange={event => setMenuImportCsv(event.target.value)}
              className="min-h-[220px] w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-transparent px-3 py-2 font-mono text-xs text-[var(--text-primary)]"
              placeholder="section_id,section_name,item_id,item_name,description,base_price,vat_rate,station,active,stock_count"
            />
          </div>
        </Modal>
      )}

      {role === "admin" && showResetRuntimeConfirm && (
        <Modal
          title="Reset runtime state"
          onCancel={() => setShowResetRuntimeConfirm(false)}
          onConfirm={() => applyAction("RESET_RUNTIME")}
          confirmLabel="Reset now"
          confirmDisabled={busyKey === "RESET_RUNTIME"}
        >
          This will clear all active sessions, orders, and tag assignments immediately.
        </Modal>
      )}
    </div>
  )
}
