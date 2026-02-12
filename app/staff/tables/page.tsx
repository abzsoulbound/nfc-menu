"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"
import { Divider } from "@/components/ui/Divider"
import { Button } from "@/components/ui/Button"
import { TableAssignment } from "@/components/staff/TableAssignment"
import {
  BillingData,
  BillingSplitPanel,
} from "@/components/staff/BillingSplitPanel"

type Table = {
  id: string
  number: number
  locked: boolean
  stale: boolean
  closed: boolean
  paid: boolean
  openedAt: string
  contributionWindowEndsAt: string
}

type Tag = {
  id: string
  tableNumber: number | null
  activeSessionCount: number
}

type TableCatalog = {
  fixedTableNumbers: number[]
  temporaryTableNumbers: number[]
}

export default function StaffTablesPage() {
  const [tables, setTables] = useState<Table[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [tableCatalog, setTableCatalog] = useState<TableCatalog>({
    fixedTableNumbers: [],
    temporaryTableNumbers: [],
  })
  const [activeTable, setActiveTable] = useState<Table | null>(null)
  const [showSeatingPanel, setShowSeatingPanel] = useState(false)
  const [billingData, setBillingData] = useState<BillingData | null>(null)
  const [billingLoading, setBillingLoading] = useState(false)
  const [billingError, setBillingError] = useState<string | null>(null)

  async function parseArrayResponse<T>(
    res: Response
  ): Promise<T[]> {
    const raw = await res.text()
    if (!raw) return []

    try {
      const parsed = JSON.parse(raw) as unknown
      return Array.isArray(parsed) ? (parsed as T[]) : []
    } catch {
      return []
    }
  }

  async function parseObjectResponse<T>(
    res: Response
  ): Promise<T | null> {
    const raw = await res.text()
    if (!raw) return null

    try {
      const parsed = JSON.parse(raw) as unknown
      if (!parsed || typeof parsed !== "object") return null
      return parsed as T
    } catch {
      return null
    }
  }

  async function fetchTables(): Promise<Table[]> {
    try {
      const res = await fetch("/api/tables", { cache: "no-store" })
      const data = await parseArrayResponse<Table>(res)
      setTables(data)
      setActiveTable(current => {
        if (!current) return current
        return data.find(table => table.number === current.number) ?? null
      })
      return data
    } catch {
      // keep existing values on transient failures
      return []
    }
  }

  async function fetchTags() {
    try {
      const res = await fetch("/api/tags", { cache: "no-store" })
      const data = await parseArrayResponse<Tag>(res)
      setTags(data)
    } catch {
      // keep existing values on transient failures
    }
  }

  async function fetchTableCatalog() {
    try {
      const res = await fetch("/api/staff/table-catalog", {
        cache: "no-store",
      })
      const payload = await parseObjectResponse<TableCatalog>(res)
      if (!payload) return

      setTableCatalog({
        fixedTableNumbers: Array.isArray(payload.fixedTableNumbers)
          ? payload.fixedTableNumbers
              .map(value => Number(value))
              .filter(value => Number.isInteger(value) && value > 0)
              .sort((a, b) => a - b)
          : [],
        temporaryTableNumbers: Array.isArray(payload.temporaryTableNumbers)
          ? payload.temporaryTableNumbers
              .map(value => Number(value))
              .filter(value => Number.isInteger(value) && value > 0)
              .sort((a, b) => a - b)
          : [],
      })
    } catch {
      // keep current catalog when fetch fails
    }
  }

  async function refreshData() {
    await Promise.all([
      fetchTables(),
      fetchTags(),
      fetchTableCatalog(),
    ])
  }

  async function fetchBilling(
    tableNumber: number,
    options?: { silent?: boolean }
  ) {
    const silent = options?.silent === true
    if (!silent) {
      setBillingLoading(true)
    }

    try {
      const res = await fetch(
        `/api/billing?tableNumber=${tableNumber}`,
        {
          cache: "no-store",
        }
      )

      if (!res.ok) {
        const payload = await parseObjectResponse<{
          error?: string
        }>(res)
        setBillingData(null)
        setBillingError(payload?.error ?? "BILLING_FETCH_FAILED")
        return
      }

      const payload = await parseObjectResponse<BillingData>(res)
      if (!payload) {
        setBillingData(null)
        setBillingError("BILLING_PARSE_FAILED")
        return
      }

      setBillingData(payload)
      setBillingError(null)
    } catch {
      if (!silent) {
        setBillingData(null)
        setBillingError("BILLING_FETCH_FAILED")
      }
    } finally {
      if (!silent) {
        setBillingLoading(false)
      }
    }
  }

  useEffect(() => {
    refreshData()

    const activeTableNumber = activeTable?.number
    const interval = setInterval(() => {
      refreshData()
      if (activeTableNumber) {
        fetchBilling(activeTableNumber, { silent: true })
      }
    }, 5000)
    return () => clearInterval(interval)
  }, [activeTable?.number])

  useEffect(() => {
    if (!activeTable) {
      setBillingData(null)
      setBillingError(null)
      setBillingLoading(false)
      return
    }
    fetchBilling(activeTable.number)
  }, [activeTable?.number])

  function minutesSince(ts: string) {
    return Math.floor(
      (Date.now() - new Date(ts).getTime()) / 60000
    )
  }

  async function lockTable(tableId: string, lock: boolean) {
    await fetch("/api/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: lock ? "LOCK_TABLE" : "UNLOCK_TABLE",
        tableId,
      }),
    })
    fetchTables()
  }

  async function closeTable(tableId: string, paid: boolean) {
    await fetch("/api/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: paid ? "CLOSE_PAID" : "CLOSE_UNPAID",
        tableId,
      }),
    })
    setActiveTable(null)
    setBillingData(null)
    setBillingError(null)
    refreshData()
  }

  async function onSeatingUpdated(
    tableNumber: number,
    options?: { stayOnTable?: boolean }
  ) {
    const nextTables = await fetchTables()
    await Promise.all([fetchTags(), fetchTableCatalog()])

    if (options?.stayOnTable) {
      const nextTable =
        nextTables.find(table => table.number === tableNumber) ?? null
      setActiveTable(nextTable)
      if (nextTable) {
        await fetchBilling(nextTable.number)
      } else {
        setBillingData(null)
        setBillingError(null)
      }
      return
    }

    setShowSeatingPanel(false)
  }

  if (activeTable) {
    const assignedTags = tags.filter(
      t => t.tableNumber === activeTable.number
    )

    return (
      <div className="p-4 space-y-4">
        <Card>
          <div className="flex justify-between items-center">
            <div className="text-lg font-semibold">
              Table {activeTable.number}
            </div>
            <div className="flex gap-2">
              {activeTable.locked && <Badge>locked</Badge>}
              {activeTable.stale && <Badge>stale</Badge>}
              {!activeTable.paid && activeTable.closed && (
                <Badge>unpaid</Badge>
              )}
            </div>
          </div>
        </Card>

        <TableAssignment
          fixedTableNumbers={tableCatalog.fixedTableNumbers}
          temporaryTableNumbers={tableCatalog.temporaryTableNumbers}
          tags={tags}
          defaultTableNumber={activeTable.number}
          initialTagIds={assignedTags.map(tag => tag.id)}
          onComplete={async result => {
            await onSeatingUpdated(result.tableNo, {
              stayOnTable: true,
            })
          }}
        />

        <BillingSplitPanel
          data={billingData}
          loading={billingLoading}
          error={billingError}
          onRefresh={() => {
            fetchBilling(activeTable.number)
          }}
        />

        <Divider />

        <div className="grid grid-cols-2 gap-2">
          <Card
            className="cursor-pointer text-center"
            onClick={() => lockTable(activeTable.id, !activeTable.locked)}
          >
            {activeTable.locked ? "Unlock table" : "Lock table"}
          </Card>

          <Card
            className="cursor-pointer text-center"
            onClick={() => closeTable(activeTable.id, true)}
          >
            Close as paid
          </Card>

          <Card
            className="cursor-pointer text-center"
            onClick={() => closeTable(activeTable.id, false)}
          >
            Close as unpaid
          </Card>
        </div>

        <Card
          className="cursor-pointer text-center opacity-70"
          onClick={() => setActiveTable(null)}
        >
          Back to tables
        </Card>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      <Card>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <div className="space-y-1">
              <div className="text-lg font-semibold">
                Seat new table
              </div>
              <div className="text-sm opacity-70">
                Select a table number, assign NFC numbers, and confirm.
              </div>
            </div>
            <Button
              variant={showSeatingPanel ? "secondary" : "primary"}
              onClick={() => setShowSeatingPanel(current => !current)}
            >
              {showSeatingPanel ? "Hide seating" : "Start seating"}
            </Button>
          </div>

          {showSeatingPanel && (
            <TableAssignment
              fixedTableNumbers={tableCatalog.fixedTableNumbers}
              temporaryTableNumbers={tableCatalog.temporaryTableNumbers}
              tags={tags}
              onComplete={async result => {
                await onSeatingUpdated(result.tableNo)
              }}
              onCancel={() => setShowSeatingPanel(false)}
            />
          )}
        </div>
      </Card>

      <Divider />

      <div className="text-sm opacity-70">
        Active tables
      </div>

      {tables.map(table => (
        <Card
          key={table.id}
          onClick={() => setActiveTable(table)}
          className="cursor-pointer"
        >
          <div className="flex justify-between items-center">
            <div className="space-y-1">
              <div className="text-lg font-semibold">
                Table {table.number}
              </div>
              <div className="text-sm opacity-70">
                Open {minutesSince(table.openedAt)}m ago ·{" "}
                {tags.filter(tag => tag.tableNumber === table.number).length} NFC
              </div>
            </div>

            <div className="flex gap-2 items-center">
              {table.locked && <Badge>locked</Badge>}
              {table.stale && <Badge>stale</Badge>}
              {!table.paid && table.closed && (
                <Badge>unpaid</Badge>
              )}
            </div>
          </div>
        </Card>
      ))}

      {tables.length === 0 && (
        <div className="opacity-60 text-center">
          No active tables
        </div>
      )}
    </div>
  )
}
