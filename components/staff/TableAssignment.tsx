"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/Button"
import {
  formatTableNumber,
  parseTableReferenceInput,
} from "@/lib/tableCatalog"
import styles from "./TableAssignment.module.css"

type TagOption = {
  id: string
  tableNumber: number | null
}

type SeatingResult = {
  ok: boolean
  tableNo: number
  assignedTagIds: string[]
  masterTableId: string
}

function parseTableNo(value: string): number | null {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) return null
  return parsed
}

function getApiErrorMessage(
  payload: { error?: string; [key: string]: unknown } | null
) {
  switch (payload?.error) {
    case "TAG_NOT_REGISTERED":
      return "One or more NFC numbers are not registered."
    case "TAG_ALREADY_ASSIGNED":
      return "At least one selected NFC is already assigned to another active table."
    case "TABLE_TEMPORARY_REQUIRED":
      return "This table number is not in the fixed list. Mark it as a temporary table."
    case "TABLE_FIXED_RESERVED":
      return "Fixed table numbers are reserved. Use a temporary reference instead."
    case "TABLE_NOT_ALLOWED":
      return "This table number is not allowed."
    case "SEATING_CONFLICT_RETRY":
      return "Another staff device updated seating at the same time. Please retry."
    default:
      return "Could not save seating. Please try again."
  }
}

function defaultTemporaryNumber(
  fixedTableNumbers: number[],
  temporaryTableNumbers: number[]
) {
  const used = new Set([
    ...fixedTableNumbers,
    ...temporaryTableNumbers,
  ])

  const fixedMax =
    fixedTableNumbers.length > 0
      ? Math.max(...fixedTableNumbers)
      : 0
  let candidate = fixedMax + 1
  while (used.has(candidate)) {
    candidate += 1
  }
  return candidate
}

export function TableAssignment({
  fixedTableNumbers,
  temporaryTableNumbers,
  tags,
  onComplete,
  defaultTableNumber = null,
  initialTagIds = [],
  onCancel,
  mode = "default",
}: {
  fixedTableNumbers: number[]
  temporaryTableNumbers: number[]
  tags: TagOption[]
  onComplete: (result: SeatingResult) => void
  defaultTableNumber?: number | null
  initialTagIds?: string[]
  onCancel?: () => void
  mode?: "default" | "manual-temporary"
}) {
  const fixedSet = useMemo(
    () => new Set(fixedTableNumbers),
    [fixedTableNumbers]
  )
  const allowsTableSelection = defaultTableNumber === null
  const usesManualTemporaryInput =
    allowsTableSelection && mode === "manual-temporary"
  const defaultTableIsTemporary =
    defaultTableNumber !== null && !fixedSet.has(defaultTableNumber)

  const [selectionMode, setSelectionMode] = useState<"fixed" | "temporary">(
    defaultTableIsTemporary ? "temporary" : "fixed"
  )
  const [fixedTableInput, setFixedTableInput] = useState<string>(() => {
    if (defaultTableNumber !== null && fixedSet.has(defaultTableNumber)) {
      return String(defaultTableNumber)
    }
    if (fixedTableNumbers.length > 0) {
      return String(fixedTableNumbers[0])
    }
    return ""
  })
  const [temporaryTableInput, setTemporaryTableInput] =
    useState<string>(() => {
      if (defaultTableNumber !== null && !fixedSet.has(defaultTableNumber)) {
        return String(defaultTableNumber)
      }
      return String(
        defaultTemporaryNumber(
          fixedTableNumbers,
          temporaryTableNumbers
        )
      )
    })
  const [manualTableReferenceInput, setManualTableReferenceInput] =
    useState<string>(() =>
      String(
        defaultTemporaryNumber(
          fixedTableNumbers,
          temporaryTableNumbers
        )
      )
    )
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(() =>
    Array.from(new Set(initialTagIds))
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sortedTags = useMemo(
    () =>
      [...tags].sort((a, b) =>
        a.id.localeCompare(b.id, undefined, {
          numeric: true,
          sensitivity: "base",
        })
      ),
    [tags]
  )
  const tagsById = useMemo(() => {
    const map = new Map<string, TagOption>()
    for (const tag of sortedTags) {
      map.set(tag.id, tag)
    }
    return map
  }, [sortedTags])

  const parsedManualReference = useMemo(
    () =>
      usesManualTemporaryInput
        ? parseTableReferenceInput(manualTableReferenceInput)
        : null,
    [usesManualTemporaryInput, manualTableReferenceInput]
  )

  const resolvedTableNo = useMemo(() => {
    if (parsedManualReference) {
      return parsedManualReference.tableNo
    }
    if (defaultTableNumber !== null) return defaultTableNumber
    if (selectionMode === "fixed") {
      return parseTableNo(fixedTableInput)
    }
    return parseTableNo(temporaryTableInput)
  }, [
    defaultTableNumber,
    fixedTableInput,
    parsedManualReference,
    selectionMode,
    temporaryTableInput,
  ])

  const tableIsTemporary = useMemo(() => {
    if (usesManualTemporaryInput) return true
    if (defaultTableNumber !== null) {
      return !fixedSet.has(defaultTableNumber)
    }
    if (selectionMode === "temporary") return true
    if (!resolvedTableNo) return false
    return !fixedSet.has(resolvedTableNo)
  }, [
    defaultTableNumber,
    fixedSet,
    resolvedTableNo,
    selectionMode,
    usesManualTemporaryInput,
  ])

  const selectedTableLabel = useMemo(() => {
    if (parsedManualReference?.displayLabel) {
      return `Table ${parsedManualReference.displayLabel}`
    }
    if (resolvedTableNo) {
      return `Table ${formatTableNumber(resolvedTableNo)}`
    }
    return "No table selected"
  }, [parsedManualReference, resolvedTableNo])

  const canSelectTag = (tag: TagOption) => {
    if (!resolvedTableNo) return false
    return (
      tag.tableNumber === null ||
      tag.tableNumber === resolvedTableNo
    )
  }

  const fixedOverflowConflict = Boolean(
    usesManualTemporaryInput &&
      parsedManualReference &&
      !parsedManualReference.encoded &&
      resolvedTableNo &&
      fixedSet.has(resolvedTableNo)
  )
  const existingTemporaryConflict = Boolean(
    usesManualTemporaryInput &&
      parsedManualReference &&
      resolvedTableNo &&
      temporaryTableNumbers.includes(resolvedTableNo)
  )

  const canReview =
    resolvedTableNo !== null &&
    selectedTagIds.length > 0 &&
    !fixedOverflowConflict &&
    !existingTemporaryConflict

  const toggleTag = (tagId: string) => {
    if (submitting) return
    setError(null)
    setSelectedTagIds(current => {
      if (current.includes(tagId)) {
        return current.filter(value => value !== tagId)
      }
      return [...current, tagId]
    })
  }

  const resetAfterSuccess = (nextAssigned: string[]) => {
    setError(null)
    if (usesManualTemporaryInput) {
      setSelectedTagIds([])
      return
    }

    if (defaultTableNumber === null) {
      setSelectedTagIds([])
    } else {
      setSelectedTagIds(nextAssigned)
    }
  }

  async function submitSeating() {
    if (!canReview || !resolvedTableNo) {
      setError("Choose a table number and at least one NFC number.")
      return
    }

    if (fixedOverflowConflict) {
      setError(
        "Use a temporary reference outside fixed tables (for example 26 or 9A)."
      )
      return
    }

    if (existingTemporaryConflict) {
      setError("This table reference is already in use. Enter a new temporary table.")
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      const response = await fetch("/api/staff/seating", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableNo: resolvedTableNo,
          tagIds: selectedTagIds,
          isTemporary: tableIsTemporary,
        }),
      })

      const payload = (await response
        .json()
        .catch(() => null)) as SeatingResult & {
        error?: string
      } | null

      if (!response.ok || !payload) {
        setError(getApiErrorMessage(payload))
        return
      }

      resetAfterSuccess(payload.assignedTagIds)
      onComplete(payload)
    } catch {
      setError("Could not save seating. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  useEffect(() => {
    setSelectedTagIds(current =>
      current.filter(tagId => {
        const tag = tagsById.get(tagId)
        if (!tag || !resolvedTableNo) return false
        return (
          tag.tableNumber === null ||
          tag.tableNumber === resolvedTableNo
        )
      })
    )
  }, [resolvedTableNo, tagsById])

  return (
    <div className={styles.wrapper}>
      {allowsTableSelection && (
        <>
          {usesManualTemporaryInput ? (
            <>
              <div className="text-sm opacity-70">
                Table number
              </div>
              <input
                className="input"
                type="text"
                value={manualTableReferenceInput}
                onChange={event => {
                  setManualTableReferenceInput(event.target.value)
                  setError(null)
                }}
                disabled={submitting}
                placeholder="Example: 26 or 9A"
              />
              <div className="text-xs opacity-60">
                Use a unique temporary reference, then select NFC tags and confirm.
              </div>
              {fixedOverflowConflict && (
                <div className={styles.error}>
                  This matches a fixed table. Use a temporary number (26+) or a
                  letter suffix like 9A.
                </div>
              )}
              {existingTemporaryConflict && (
                <div className={styles.error}>
                  This table reference is already in use. Enter a new temporary
                  table.
                </div>
              )}
            </>
          ) : (
            <>
              <div className="text-sm opacity-70">
                Select table type
              </div>
              <div className={styles.selectionMode}>
                <label className={styles.modeLabel}>
                  <input
                    type="radio"
                    name="table-mode"
                    checked={selectionMode === "fixed"}
                    onChange={() => {
                      setSelectionMode("fixed")
                      setError(null)
                    }}
                    disabled={submitting}
                  />
                  Fixed table
                </label>
                <label className={styles.modeLabel}>
                  <input
                    type="radio"
                    name="table-mode"
                    checked={selectionMode === "temporary"}
                    onChange={() => {
                      setSelectionMode("temporary")
                      setError(null)
                    }}
                    disabled={submitting}
                  />
                  Temporary table
                </label>
              </div>

              {selectionMode === "fixed" ? (
                <select
                  className="input"
                  value={fixedTableInput}
                  onChange={event => {
                    setFixedTableInput(event.target.value)
                    setError(null)
                  }}
                  disabled={submitting}
                >
                  {fixedTableNumbers.map(tableNumber => (
                    <option
                      key={tableNumber}
                      value={tableNumber}
                    >
                      Table {formatTableNumber(tableNumber)}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className="input"
                  type="number"
                  min={1}
                  value={temporaryTableInput}
                  onChange={event => {
                    setTemporaryTableInput(event.target.value)
                    setError(null)
                  }}
                  disabled={submitting}
                  placeholder="Temporary table number"
                />
              )}
            </>
          )}
        </>
      )}

      {!allowsTableSelection && (
        <div className="text-sm opacity-70">
          {tableIsTemporary
            ? `${selectedTableLabel} (temporary)`
            : selectedTableLabel}
        </div>
      )}

      <div className="text-sm opacity-70">
        Select NFC numbers
      </div>

      <div className={styles.tagGrid}>
        {sortedTags.map(tag => {
          const checked = selectedTagIds.includes(tag.id)
          const selectable = canSelectTag(tag)

          return (
            <label
              key={tag.id}
              className={`${styles.tagOption} ${
                !selectable ? styles.tagOptionDisabled : ""
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={!selectable || submitting}
                onChange={() => toggleTag(tag.id)}
              />
              <span className={styles.tagText}>
                <span className={styles.tagId}>{tag.id}</span>
                <span className={styles.tagMeta}>
                  {tag.tableNumber === null
                    ? "Unassigned"
                    : `Assigned to table ${formatTableNumber(
                        tag.tableNumber
                      )}`}
                </span>
              </span>
            </label>
          )
        })}
      </div>

      {sortedTags.length === 0 && (
        <div className="text-sm opacity-60">
          No registered NFC numbers yet.
        </div>
      )}

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.actions}>
        <Button
          onClick={submitSeating}
          disabled={!canReview || submitting}
        >
          {submitting ? "Saving..." : "Confirm seating"}
        </Button>

        {onCancel && (
          <Button
            variant="secondary"
            onClick={onCancel}
            disabled={submitting}
          >
            Cancel
          </Button>
        )}
      </div>
    </div>
  )
}
