const DEFAULT_TABLE_NUMBERS = Array.from(
  { length: 20 },
  (_, index) => index + 1
)

function parsePositiveInteger(value: string): number | null {
  if (!/^\d+$/.test(value)) return null
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) return null
  return parsed
}

function expandToken(token: string): number[] {
  const trimmed = token.trim()
  if (!trimmed) return []

  const rangeMatch = trimmed.match(/^(\d+)\s*-\s*(\d+)$/)
  if (rangeMatch) {
    const start = parsePositiveInteger(rangeMatch[1])
    const end = parsePositiveInteger(rangeMatch[2])
    if (!start || !end) return []

    const min = Math.min(start, end)
    const max = Math.max(start, end)
    const values: number[] = []
    for (let current = min; current <= max; current += 1) {
      values.push(current)
    }
    return values
  }

  const value = parsePositiveInteger(trimmed)
  return value ? [value] : []
}

export function parseTableNumbers(
  input: string | undefined
): number[] {
  if (!input) return []

  const values = new Set<number>()
  const tokens = input.split(",")
  for (const token of tokens) {
    for (const value of expandToken(token)) {
      values.add(value)
    }
  }

  return Array.from(values).sort((a, b) => a - b)
}

export function getFixedTableNumbers(): number[] {
  const configured = parseTableNumbers(process.env.TABLE_NUMBERS)
  if (configured.length > 0) return configured
  return DEFAULT_TABLE_NUMBERS
}

export function isFixedTableNumber(tableNo: number): boolean {
  return getFixedTableNumbers().includes(tableNo)
}

export function isAllowedTemporaryTableNumber(
  tableNo: number
): boolean {
  return (
    Number.isInteger(tableNo) &&
    tableNo > 0 &&
    !isFixedTableNumber(tableNo)
  )
}
