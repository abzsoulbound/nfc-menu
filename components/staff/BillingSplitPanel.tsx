"use client"

import { useEffect, useMemo, useState } from "react"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { Divider } from "@/components/ui/Divider"

type SplitMode = "device" | "item" | "amount"

type BillingTotals = {
  subtotal: number
  vat: number
  total: number
}

type BillingLineItem = {
  orderId: string
  orderItemId: string
  sessionId: string
  tagId: string
  name: string
  quantity: number
  unitPrice: number
  vatRate: number
  status: string
  submittedAt: string
  lineTotal: number
  vatAmount: number
}

type BillingDevice = {
  sessionId: string
  tagId: string
  itemCount: number
  totals: BillingTotals
}

export type BillingData = {
  tableNumber: number
  masterTableId: string
  groupedTableIds: string[]
  totals: BillingTotals
  lineItems: BillingLineItem[]
  devices: BillingDevice[]
  generatedAt: string
}

type ItemSplitRow = {
  payerId: string
  label: string
  itemCount: number
  totals: BillingTotals
  totalCents: number
}

type AmountSplitRow = {
  payerId: string
  label: string
  dueCents: number
}

type Payer = {
  id: string
  label: string
}

function toMoney(value: number) {
  return Math.round(value * 100) / 100
}

function toCents(value: number) {
  return Math.round(value * 100)
}

function fromCents(cents: number) {
  return cents / 100
}

function toTotals(
  totalCents: number,
  vatCents: number
): BillingTotals {
  return {
    subtotal: toMoney(fromCents(totalCents - vatCents)),
    vat: toMoney(fromCents(vatCents)),
    total: toMoney(fromCents(totalCents)),
  }
}

function moneyLabel(value: number) {
  return `GBP ${value.toFixed(2)}`
}

function shortId(value: string) {
  if (value.length <= 8) return value
  return `${value.slice(0, 4)}...${value.slice(-4)}`
}

function clampInteger(
  value: number,
  min: number,
  max: number
) {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, Math.floor(value)))
}

function extractVatCents(
  totalCents: number,
  vatRate: number
) {
  if (!Number.isFinite(vatRate) || vatRate <= 0) return 0
  const total = fromCents(totalCents)
  const vat = total - total / (1 + vatRate)
  return toCents(vat)
}

function buildPayers(count: number): Payer[] {
  const safeCount = clampInteger(count, 1, 12)
  return Array.from({ length: safeCount }, (_, index) => ({
    id: `payer-${index + 1}`,
    label: `Payer ${index + 1}`,
  }))
}

function equalSplitCents(
  totalCents: number,
  count: number
) {
  const safeCount = clampInteger(count, 1, 12)
  const base = Math.floor(totalCents / safeCount)
  let remainder = totalCents - base * safeCount

  return Array.from({ length: safeCount }, () => {
    const value = base + (remainder > 0 ? 1 : 0)
    remainder = Math.max(0, remainder - 1)
    return value
  })
}

function parseMoneyInputToCents(rawValue: string) {
  const normalized = rawValue
    .replace(/[^\d.]/g, "")
    .trim()
  if (!normalized) return 0
  const parsed = Number(normalized)
  if (!Number.isFinite(parsed) || parsed < 0) return 0
  return toCents(parsed)
}

function parseIntegerInput(rawValue: string) {
  const normalized = rawValue.replace(/[^\d]/g, "")
  if (!normalized) return 0
  const parsed = Number.parseInt(normalized, 10)
  return Number.isFinite(parsed) ? parsed : 0
}

export function BillingSplitPanel({
  data,
  loading,
  error,
  onRefresh,
}: {
  data: BillingData | null
  loading: boolean
  error: string | null
  onRefresh: () => void
}) {
  const [mode, setMode] = useState<SplitMode>("device")
  const [itemPayerCount, setItemPayerCount] = useState(2)
  const [amountPayerCount, setAmountPayerCount] = useState(2)
  const [itemAllocations, setItemAllocations] = useState<
    Record<string, Record<string, number>>
  >({})
  const [amountValues, setAmountValues] = useState<
    Record<string, string>
  >({})

  const itemPayers = useMemo(
    () => buildPayers(itemPayerCount),
    [itemPayerCount]
  )
  const amountPayers = useMemo(
    () => buildPayers(amountPayerCount),
    [amountPayerCount]
  )

  const deviceIndexBySessionId = useMemo(() => {
    const map = new Map<string, number>()
    for (const [index, device] of (data?.devices ?? []).entries()) {
      map.set(device.sessionId, index)
    }
    return map
  }, [data?.devices])

  useEffect(() => {
    if (!data) return
    const suggestedCount = clampInteger(
      data.devices.length || 2,
      1,
      12
    )
    setMode("device")
    setItemPayerCount(suggestedCount)
    setAmountPayerCount(suggestedCount)
    setItemAllocations({})
    setAmountValues({})
  }, [data?.masterTableId])

  useEffect(() => {
    if (!data) {
      setItemAllocations({})
      return
    }

    setItemAllocations(prev => {
      const next: Record<string, Record<string, number>> = {}

      for (const line of data.lineItems) {
        const previousLine = prev[line.orderItemId] ?? {}
        const row: Record<string, number> = {}
        let assignedQty = 0

        for (const payer of itemPayers) {
          const value = clampInteger(
            previousLine[payer.id] ?? 0,
            0,
            line.quantity
          )
          row[payer.id] = value
          assignedQty += value
        }

        if (assignedQty > line.quantity) {
          let overflow = assignedQty - line.quantity
          for (
            let index = itemPayers.length - 1;
            index >= 0 && overflow > 0;
            index -= 1
          ) {
            const payerId = itemPayers[index].id
            const deduct = Math.min(row[payerId], overflow)
            row[payerId] -= deduct
            overflow -= deduct
          }
        }

        const hasAnyAssigned = Object.values(row).some(
          qty => qty > 0
        )
        if (!hasAnyAssigned && itemPayers.length > 0) {
          const mappedIndex = deviceIndexBySessionId.get(
            line.sessionId
          )
          const fallbackPayer =
            mappedIndex !== undefined &&
            mappedIndex < itemPayers.length
              ? itemPayers[mappedIndex]
              : itemPayers[0]
          row[fallbackPayer.id] = line.quantity
        }

        next[line.orderItemId] = row
      }

      return next
    })
  }, [data, itemPayers, deviceIndexBySessionId])

  useEffect(() => {
    if (!data) {
      setAmountValues({})
      return
    }

    const totalCents = toCents(data.totals.total)
    setAmountValues(prev => {
      const next: Record<string, string> = {}
      let hasExistingValue = false

      for (const payer of amountPayers) {
        const existing = prev[payer.id]
        if (typeof existing === "string" && existing.trim().length > 0) {
          next[payer.id] = existing
          hasExistingValue = true
        } else {
          next[payer.id] = ""
        }
      }

      if (!hasExistingValue) {
        const equalCents = equalSplitCents(
          totalCents,
          amountPayers.length
        )
        for (const [index, payer] of amountPayers.entries()) {
          next[payer.id] = fromCents(equalCents[index]).toFixed(2)
        }
      }

      return next
    })
  }, [data, amountPayers])

  const itemSplit = useMemo(() => {
    const tableTotalCents = toCents(data?.totals.total ?? 0)
    if (!data) {
      return {
        rows: [] as ItemSplitRow[],
        unassignedQty: 0,
        unassignedTotals: {
          subtotal: 0,
          vat: 0,
          total: 0,
        },
        assignedTotalCents: 0,
        tableTotalCents,
      }
    }

    const payerCents = new Map<
      string,
      { itemCount: number; totalCents: number; vatCents: number }
    >()
    for (const payer of itemPayers) {
      payerCents.set(payer.id, {
        itemCount: 0,
        totalCents: 0,
        vatCents: 0,
      })
    }

    let unassignedQty = 0
    let unassignedTotalCents = 0
    let unassignedVatCents = 0

    for (const line of data.lineItems) {
      const row = itemAllocations[line.orderItemId] ?? {}
      let assignedQty = 0

      for (const payer of itemPayers) {
        const qty = clampInteger(
          row[payer.id] ?? 0,
          0,
          line.quantity
        )
        if (qty <= 0) continue

        assignedQty += qty

        const lineTotalCents = toCents(line.unitPrice * qty)
        const lineVatCents = extractVatCents(
          lineTotalCents,
          line.vatRate
        )

        const target = payerCents.get(payer.id)
        if (!target) continue
        target.itemCount += qty
        target.totalCents += lineTotalCents
        target.vatCents += lineVatCents
      }

      if (assignedQty < line.quantity) {
        const remainingQty = line.quantity - assignedQty
        const remainingTotalCents = toCents(
          line.unitPrice * remainingQty
        )
        const remainingVatCents = extractVatCents(
          remainingTotalCents,
          line.vatRate
        )

        unassignedQty += remainingQty
        unassignedTotalCents += remainingTotalCents
        unassignedVatCents += remainingVatCents
      }
    }

    const rows = itemPayers.map(payer => {
      const current = payerCents.get(payer.id) ?? {
        itemCount: 0,
        totalCents: 0,
        vatCents: 0,
      }

      return {
        payerId: payer.id,
        label: payer.label,
        itemCount: current.itemCount,
        totals: toTotals(current.totalCents, current.vatCents),
        totalCents: current.totalCents,
      }
    })

    const assignedTotalCents = rows.reduce(
      (sum, row) => sum + row.totalCents,
      0
    )

    return {
      rows,
      unassignedQty,
      unassignedTotals: toTotals(
        unassignedTotalCents,
        unassignedVatCents
      ),
      assignedTotalCents,
      tableTotalCents,
    }
  }, [data, itemAllocations, itemPayers])

  const amountSplit = useMemo(() => {
    const rows: AmountSplitRow[] = amountPayers.map(payer => ({
      payerId: payer.id,
      label: payer.label,
      dueCents: parseMoneyInputToCents(
        amountValues[payer.id] ?? "0"
      ),
    }))
    const assignedCents = rows.reduce(
      (sum, row) => sum + row.dueCents,
      0
    )
    const tableTotalCents = toCents(data?.totals.total ?? 0)
    const deltaCents = tableTotalCents - assignedCents

    return {
      rows,
      assignedCents,
      tableTotalCents,
      deltaCents,
    }
  }, [amountPayers, amountValues, data?.totals.total])

  const lineAllocationRemaining = (line: BillingLineItem) => {
    const row = itemAllocations[line.orderItemId] ?? {}
    const assigned = itemPayers.reduce(
      (sum, payer) =>
        sum + clampInteger(row[payer.id] ?? 0, 0, line.quantity),
      0
    )
    return Math.max(0, line.quantity - assigned)
  }

  const updateItemAllocation = (
    orderItemId: string,
    payerId: string,
    maxQty: number,
    rawValue: string
  ) => {
    setItemAllocations(prev => {
      const previousLine = prev[orderItemId] ?? {}
      const row: Record<string, number> = {}
      for (const payer of itemPayers) {
        row[payer.id] = clampInteger(
          previousLine[payer.id] ?? 0,
          0,
          maxQty
        )
      }

      const requested = clampInteger(
        parseIntegerInput(rawValue),
        0,
        maxQty
      )
      const assignedWithoutTarget = Object.entries(row).reduce(
        (sum, [id, qty]) => (id === payerId ? sum : sum + qty),
        0
      )
      const maxForTarget = Math.max(
        0,
        maxQty - assignedWithoutTarget
      )
      row[payerId] = Math.min(requested, maxForTarget)

      return {
        ...prev,
        [orderItemId]: row,
      }
    })
  }

  const autoAllocateItemsByDevice = () => {
    if (!data || itemPayers.length === 0) return

    setItemAllocations(() => {
      const next: Record<string, Record<string, number>> = {}

      for (const line of data.lineItems) {
        const mappedIndex = deviceIndexBySessionId.get(
          line.sessionId
        )
        const targetPayer =
          mappedIndex !== undefined &&
          mappedIndex < itemPayers.length
            ? itemPayers[mappedIndex]
            : itemPayers[0]
        const row: Record<string, number> = {}
        for (const payer of itemPayers) {
          row[payer.id] = 0
        }
        row[targetPayer.id] = line.quantity
        next[line.orderItemId] = row
      }

      return next
    })
  }

  const equalizeAmounts = () => {
    if (!data) return
    const equalCents = equalSplitCents(
      toCents(data.totals.total),
      amountPayers.length
    )
    setAmountValues(prev => {
      const next = { ...prev }
      for (const [index, payer] of amountPayers.entries()) {
        next[payer.id] = fromCents(equalCents[index]).toFixed(2)
      }
      return next
    })
  }

  const applyDeviceTotalsToAmounts = () => {
    if (!data) return
    setAmountValues(prev => {
      const next = { ...prev }
      for (const [index, payer] of amountPayers.entries()) {
        const total = data.devices[index]?.totals.total ?? 0
        next[payer.id] = total.toFixed(2)
      }
      return next
    })
  }

  return (
    <Card>
      <div className="space-y-3">
        <div className="flex justify-between items-center gap-2">
          <div className="text-sm font-semibold">
            Bill split
          </div>
          <div className="flex items-center gap-2">
            {loading && <Badge>loading</Badge>}
            <Button
              variant="secondary"
              onClick={onRefresh}
              disabled={loading}
            >
              Refresh
            </Button>
          </div>
        </div>

        {error && (
          <div className="text-sm text-red-400">{error}</div>
        )}

        {!data && !loading && (
          <div className="text-sm opacity-70">
            No bill data available for this table yet.
          </div>
        )}

        {data && (
          <>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <div className="text-xs opacity-70">Subtotal</div>
                <div className="font-semibold">
                  {moneyLabel(data.totals.subtotal)}
                </div>
              </div>
              <div>
                <div className="text-xs opacity-70">VAT</div>
                <div className="font-semibold">
                  {moneyLabel(data.totals.vat)}
                </div>
              </div>
              <div>
                <div className="text-xs opacity-70">Total</div>
                <div className="font-semibold">
                  {moneyLabel(data.totals.total)}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs opacity-70">
              <span>{data.lineItems.length} bill line(s)</span>
              <span>|</span>
              <span>{data.devices.length} device(s)</span>
              <span>|</span>
              <span>
                Updated{" "}
                {new Date(data.generatedAt).toLocaleTimeString()}
              </span>
            </div>

            <Divider />

            <div className="grid grid-cols-3 gap-2">
              <Button
                variant={mode === "device" ? "primary" : "secondary"}
                onClick={() => setMode("device")}
              >
                Device
              </Button>
              <Button
                variant={mode === "item" ? "primary" : "secondary"}
                onClick={() => setMode("item")}
              >
                Item
              </Button>
              <Button
                variant={mode === "amount" ? "primary" : "secondary"}
                onClick={() => setMode("amount")}
              >
                Amount
              </Button>
            </div>

            {mode === "device" && (
              <div className="space-y-2">
                {data.devices.length === 0 && (
                  <div className="text-sm opacity-70">
                    No active device sessions for this table.
                  </div>
                )}

                {data.devices.map((device, index) => (
                  <Card key={device.sessionId}>
                    <div className="flex justify-between items-center gap-3">
                      <div className="space-y-1">
                        <div className="font-medium">
                          Device {index + 1}
                        </div>
                        <div className="text-xs opacity-70">
                          Session {shortId(device.sessionId)} | Tag{" "}
                          {shortId(device.tagId)}
                        </div>
                        <div className="text-xs opacity-70">
                          {device.itemCount} item(s)
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">
                          {moneyLabel(device.totals.total)}
                        </div>
                        <div className="text-xs opacity-70">
                          VAT {moneyLabel(device.totals.vat)}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {mode === "item" && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="item-payer-count"
                    className="text-sm opacity-70"
                  >
                    Split into
                  </label>
                  <input
                    id="item-payer-count"
                    type="number"
                    className="input"
                    min={1}
                    max={12}
                    value={itemPayerCount}
                    onChange={event =>
                      setItemPayerCount(
                        clampInteger(
                          parseIntegerInput(event.target.value),
                          1,
                          12
                        )
                      )
                    }
                    style={{ width: 92 }}
                  />
                  <span className="text-sm opacity-70">payers</span>
                  <Button
                    variant="secondary"
                    onClick={autoAllocateItemsByDevice}
                    disabled={data.lineItems.length === 0}
                  >
                    Auto by device
                  </Button>
                </div>

                {data.lineItems.length === 0 && (
                  <div className="text-sm opacity-70">
                    No order items to split yet.
                  </div>
                )}

                {data.lineItems.map(line => {
                  const remaining = lineAllocationRemaining(line)
                  const row = itemAllocations[line.orderItemId] ?? {}

                  return (
                    <Card key={line.orderItemId}>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center gap-3">
                          <div>
                            <div className="font-medium">
                              {line.quantity}x {line.name}
                            </div>
                            <div className="text-xs opacity-70">
                              Session {shortId(line.sessionId)}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-medium">
                              {moneyLabel(line.lineTotal)}
                            </div>
                            <div className="text-xs opacity-70">
                              VAT {moneyLabel(line.vatAmount)}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          {itemPayers.map(payer => (
                            <div
                              key={`${line.orderItemId}-${payer.id}`}
                              className="flex justify-between items-center gap-2"
                            >
                              <label
                                htmlFor={`${line.orderItemId}-${payer.id}`}
                                className="text-xs opacity-70"
                              >
                                {payer.label}
                              </label>
                              <input
                                id={`${line.orderItemId}-${payer.id}`}
                                type="number"
                                className="input"
                                min={0}
                                max={line.quantity}
                                value={row[payer.id] ?? 0}
                                onChange={event =>
                                  updateItemAllocation(
                                    line.orderItemId,
                                    payer.id,
                                    line.quantity,
                                    event.target.value
                                  )
                                }
                                style={{ width: 92 }}
                              />
                            </div>
                          ))}
                        </div>

                        {remaining > 0 && (
                          <div className="text-xs text-red-400">
                            {remaining} unassigned item(s)
                          </div>
                        )}
                      </div>
                    </Card>
                  )
                })}

                <Divider />

                <div className="text-sm font-semibold">
                  Item split totals
                </div>

                <div className="space-y-2">
                  {itemSplit.rows.map(row => (
                    <div
                      key={row.payerId}
                      className="flex justify-between items-center gap-3"
                    >
                      <div className="text-sm">
                        {row.label}
                        <div className="text-xs opacity-70">
                          {row.itemCount} item(s)
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">
                          {moneyLabel(row.totals.total)}
                        </div>
                        <div className="text-xs opacity-70">
                          VAT {moneyLabel(row.totals.vat)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {itemSplit.unassignedQty > 0 && (
                  <div className="text-sm text-red-400">
                    Unassigned: {itemSplit.unassignedQty} item(s) |{" "}
                    {moneyLabel(itemSplit.unassignedTotals.total)}
                  </div>
                )}

                <div className="flex justify-between items-center text-sm">
                  <div>Assigned total</div>
                  <div className="font-semibold">
                    {moneyLabel(
                      fromCents(itemSplit.assignedTotalCents)
                    )}
                  </div>
                </div>
              </div>
            )}

            {mode === "amount" && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="amount-payer-count"
                    className="text-sm opacity-70"
                  >
                    Split into
                  </label>
                  <input
                    id="amount-payer-count"
                    type="number"
                    className="input"
                    min={1}
                    max={12}
                    value={amountPayerCount}
                    onChange={event =>
                      setAmountPayerCount(
                        clampInteger(
                          parseIntegerInput(event.target.value),
                          1,
                          12
                        )
                      )
                    }
                    style={{ width: 92 }}
                  />
                  <span className="text-sm opacity-70">payers</span>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    onClick={equalizeAmounts}
                  >
                    Equal split
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={applyDeviceTotalsToAmounts}
                    disabled={data.devices.length === 0}
                  >
                    Use device totals
                  </Button>
                </div>

                <div className="space-y-2">
                  {amountSplit.rows.map(row => (
                    <div
                      key={row.payerId}
                      className="flex justify-between items-center gap-2"
                    >
                      <label
                        htmlFor={`amount-${row.payerId}`}
                        className="text-sm"
                      >
                        {row.label}
                      </label>
                      <input
                        id={`amount-${row.payerId}`}
                        type="text"
                        inputMode="decimal"
                        className="input"
                        value={amountValues[row.payerId] ?? ""}
                        onChange={event =>
                          setAmountValues(prev => ({
                            ...prev,
                            [row.payerId]: event.target.value,
                          }))
                        }
                        placeholder="0.00"
                        style={{ width: 120 }}
                      />
                    </div>
                  ))}
                </div>

                <Divider />

                <div className="flex justify-between text-sm">
                  <div>Assigned total</div>
                  <div className="font-medium">
                    {moneyLabel(fromCents(amountSplit.assignedCents))}
                  </div>
                </div>
                <div className="flex justify-between text-sm">
                  <div>Table total</div>
                  <div className="font-medium">
                    {moneyLabel(fromCents(amountSplit.tableTotalCents))}
                  </div>
                </div>
                <div className="flex justify-between text-sm">
                  <div>
                    {amountSplit.deltaCents >= 0
                      ? "Remaining"
                      : "Over-assigned"}
                  </div>
                  <div
                    className={`font-semibold ${
                      amountSplit.deltaCents === 0
                        ? ""
                        : "text-red-400"
                    }`}
                  >
                    {moneyLabel(
                      fromCents(Math.abs(amountSplit.deltaCents))
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  )
}
