export type AnalyticsEventName =
  | "menu_view"
  | "search_used"
  | "item_opened"
  | "add_to_cart"
  | "review_opened"
  | "order_confirmed"
  | "staff_ticket_action"

type AnalyticsPayload = {
  restaurantId: string
  requestId: string
  [key: string]: unknown
}

export function trackEvent(
  event: AnalyticsEventName,
  payload: AnalyticsPayload
) {
  if (typeof window === "undefined") return
  console.info("[analytics]", {
    event,
    ...payload,
    timestamp: new Date().toISOString(),
  })
}
