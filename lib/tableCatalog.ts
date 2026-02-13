const DEFAULT_TABLE_NUMBERS = Array.from(
  { length: 25 },
  (_, index) => index + 1
)
const TEMP_TABLE_REF_BASE = 100000
const TEMP_TABLE_REF_MULTIPLIER = 1000

function alphaToIndex(value: string): number | null {
  if (!/^[A-Z]+$/.test(value)) return null
  let result = 0
  for (const char of value) {
    const code = char.charCodeAt(0) - 64
    if (code < 1 || code > 26) return null
    result = result * 26 + code
  }
  return result
}

function indexToAlpha(value: number): string | null {
  if (!Number.isInteger(value) || value <= 0) return null
  let current = value
  let output = ""
  while (current > 0) {
    const remainder = (current - 1) % 26
    output = String.fromCharCode(65 + remainder) + output
    current = Math.floor((current - 1) / 26)
  }
  return output || null
}

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

export function parseTableReferenceInput(input: string): {
  tableNo: number | null
  displayLabel: string | null
  encoded: boolean
} {
  const trimmed = input.trim().toUpperCase()
  if (!trimmed) {
    return {
      tableNo: null,
      displayLabel: null,
      encoded: false,
    }
  }

  const match = trimmed.match(/^(\d+)\s*([A-Z]+)?$/)
  if (!match) {
    return {
      tableNo: null,
      displayLabel: null,
      encoded: false,
    }
  }

  const numberPart = parsePositiveInteger(match[1])
  if (!numberPart) {
    return {
      tableNo: null,
      displayLabel: null,
      encoded: false,
    }
  }

  const suffix = match[2]
  if (!suffix) {
    return {
      tableNo: numberPart,
      displayLabel: String(numberPart),
      encoded: false,
    }
  }

  const suffixIndex = alphaToIndex(suffix)
  if (!suffixIndex || suffixIndex >= TEMP_TABLE_REF_MULTIPLIER) {
    return {
      tableNo: null,
      displayLabel: null,
      encoded: false,
    }
  }

  return {
    tableNo:
      TEMP_TABLE_REF_BASE +
      numberPart * TEMP_TABLE_REF_MULTIPLIER +
      suffixIndex,
    displayLabel: `${numberPart}${suffix}`,
    encoded: true,
  }
}

export function formatTableNumber(tableNo: number): string {
  if (!Number.isInteger(tableNo) || tableNo <= 0) {
    return String(tableNo)
  }
  if (tableNo < TEMP_TABLE_REF_BASE) {
    return String(tableNo)
  }

  const offset = tableNo - TEMP_TABLE_REF_BASE
  const numberPart = Math.floor(offset / TEMP_TABLE_REF_MULTIPLIER)
  const suffixIndex = offset % TEMP_TABLE_REF_MULTIPLIER
  const suffix = indexToAlpha(suffixIndex)

  if (numberPart <= 0 || !suffix) {
    return String(tableNo)
  }
  return `${numberPart}${suffix}`
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
