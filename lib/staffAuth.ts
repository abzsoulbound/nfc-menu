export type StaffRole = "admin" | "waiter" | "bar" | "kitchen"

export const STAFF_SESSION_COOKIE = "staff_session"

export const staffAuthCookies = {
  session: STAFF_SESSION_COOKIE,
}

export function isStaffRole(value: string): value is StaffRole {
  return (
    value === "admin" ||
    value === "waiter" ||
    value === "bar" ||
    value === "kitchen"
  )
}
