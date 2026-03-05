export function toCustomerErrorMessage(error: unknown) {
  const fallback = "Something went wrong. Please try again."

  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
      ? error
      : ""

  if (!raw) return fallback

  const message = raw.toLowerCase()

  if (
    message.includes("table is not accepting new orders") ||
    message.includes("item unavailable") ||
    message.includes("ordering closed") ||
    message.includes("service")
  ) {
    return "Unavailable right now. Please ask a staff member."
  }

  if (message.includes("unauthorized")) {
    return "Your session expired. Refresh and try again."
  }

  if (
    message.includes("network") ||
    message.includes("fetch") ||
    message.includes("request failed")
  ) {
    return "Could not reach the server. Please try again."
  }

  return fallback
}
