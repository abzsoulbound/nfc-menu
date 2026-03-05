export function isCustomerMinimalModeEnabled() {
  const raw = process.env.NEXT_PUBLIC_CUSTOMER_MINIMAL_MODE
  if (!raw) return true
  const normalized = raw.trim().toLowerCase()
  return normalized !== "false" && normalized !== "0" && normalized !== "off"
}

export function showCustomerDebugLabels() {
  return !isCustomerMinimalModeEnabled() && process.env.NODE_ENV !== "production"
}
