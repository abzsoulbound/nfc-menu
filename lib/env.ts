const REQUIRED_IN_PRODUCTION = ["DATABASE_URL", "SYSTEM_AUTH_SECRET"]
const STAFF_AUTH_KEYS = [
  "STAFF_AUTH_SECRET",
  "WAITER_PASSCODES",
  "BAR_PASSCODES",
  "KITCHEN_PASSCODES",
  "MANAGER_PASSCODES",
  "ADMIN_PASSCODES",
]

let validated = false

export function validateRequiredEnv() {
  if (validated) return
  validated = true

  if (process.env.NODE_ENV !== "production") return

  const missing = REQUIRED_IN_PRODUCTION.filter(
    key => !process.env[key] || process.env[key] === "changeme"
  )

  const hasStaffAuth = STAFF_AUTH_KEYS.some(key => {
    const value = process.env[key]
    return !!value && value !== "changeme"
  })

  if (!hasStaffAuth) {
    missing.push("STAFF_AUTH_SECRET or role passcode envs")
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    )
  }
}
