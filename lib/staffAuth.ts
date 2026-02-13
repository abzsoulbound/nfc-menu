export type StaffRole = "admin" | "waiter" | "bar" | "kitchen"

const COOKIE_STAFF_AUTH = "staff_auth"
const COOKIE_STAFF_ROLE = "staff_role"
const COOKIE_STAFF_RESTAURANT = "staff_restaurant"
const COOKIE_FAILURES = "staff_auth_failures"
const COOKIE_LOCKED = "staff_auth_locked"

const ROLE_ENV: Record<StaffRole, string> = {
  admin: "ADMIN_PASSCODE",
  waiter: "WAITER_PASSCODE",
  bar: "BAR_PASSCODE",
  kitchen: "KITCHEN_PASSCODE",
}

export const staffAuthCookies = {
  auth: COOKIE_STAFF_AUTH,
  role: COOKIE_STAFF_ROLE,
  restaurant: COOKIE_STAFF_RESTAURANT,
  failures: COOKIE_FAILURES,
  locked: COOKIE_LOCKED,
}

export function isStaffRole(value: string): value is StaffRole {
  return value === "admin" || value === "waiter" || value === "bar" || value === "kitchen"
}

export function getRolePasscode(role: StaffRole) {
  return process.env[ROLE_ENV[role]] ?? process.env.STAFF_AUTH_SECRET
}

export function getManagerPasscode() {
  return process.env.MANAGER_PASSCODE ?? process.env.STAFF_AUTH_SECRET
}
