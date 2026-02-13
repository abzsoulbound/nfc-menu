import {
  argon2,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto"
import type { StaffRole } from "@/lib/staffAuth"

const ARGON2_MEMORY = 64 * 1024
const ARGON2_PASSES = 3
const ARGON2_PARALLELISM = 1
const ARGON2_TAG_LENGTH = 32
const ARGON2_NONCE_BYTES = 16
const SESSION_TOKEN_BYTES = 32

const PASSCODE_HASH_VERSION = "v1"

function deriveArgon2id(
  message: string,
  nonce: Buffer,
  pepper: string | null
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    argon2(
      "argon2id",
      {
        message: Buffer.from(message, "utf8"),
        nonce,
        parallelism: ARGON2_PARALLELISM,
        tagLength: ARGON2_TAG_LENGTH,
        memory: ARGON2_MEMORY,
        passes: ARGON2_PASSES,
        secret: pepper ? Buffer.from(pepper, "utf8") : undefined,
      },
      (error, result) => {
        if (error) {
          reject(error)
          return
        }
        resolve(result)
      }
    )
  })
}

function base64UrlEncode(value: Buffer) {
  return value.toString("base64url")
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url")
}

function getPasscodePepper() {
  const pepper = process.env.STAFF_PASSCODE_PEPPER?.trim()
  return pepper && pepper.length > 0 ? pepper : null
}

export async function hashPasscode(passcode: string) {
  const nonce = randomBytes(ARGON2_NONCE_BYTES)
  const hash = await deriveArgon2id(
    passcode,
    nonce,
    getPasscodePepper()
  )

  return [
    "argon2id",
    PASSCODE_HASH_VERSION,
    base64UrlEncode(nonce),
    base64UrlEncode(hash),
  ].join("$")
}

export async function verifyPasscode(
  passcode: string,
  encoded: string | null | undefined
) {
  if (!encoded || typeof encoded !== "string") return false

  const parts = encoded.split("$")
  if (parts.length !== 4) return false
  if (parts[0] !== "argon2id" || parts[1] !== PASSCODE_HASH_VERSION) {
    return false
  }

  const nonce = base64UrlDecode(parts[2])
  const expected = base64UrlDecode(parts[3])
  const actual = await deriveArgon2id(
    passcode,
    nonce,
    getPasscodePepper()
  )

  if (actual.length !== expected.length) return false
  return timingSafeEqual(actual, expected)
}

function getSessionPepper() {
  const pepper = process.env.STAFF_SESSION_PEPPER?.trim()
  return pepper && pepper.length > 0 ? pepper : ""
}

export function hashSessionToken(rawToken: string) {
  return createHash("sha256")
    .update(`${rawToken}.${getSessionPepper()}`)
    .digest("hex")
}

export function createSessionToken() {
  return randomBytes(SESSION_TOKEN_BYTES).toString("base64url")
}

export function getSessionTtlMs() {
  const hours = Number(process.env.STAFF_SESSION_TTL_HOURS ?? 12)
  if (!Number.isFinite(hours) || hours <= 0) return 12 * 60 * 60 * 1000
  return Math.floor(hours * 60 * 60 * 1000)
}

export function normalizeRole(value: unknown): StaffRole | null {
  const role = typeof value === "string" ? value.trim().toLowerCase() : ""
  if (role === "admin" || role === "waiter" || role === "bar" || role === "kitchen") {
    return role
  }
  return null
}

export function normalizeIdentifier(value: unknown) {
  const identifier = typeof value === "string" ? value.trim().toLowerCase() : ""
  return identifier.slice(0, 128)
}

export function requestIpAddress(req: Request) {
  const xff = req.headers.get("x-forwarded-for")
  if (xff) {
    const candidate = xff.split(",")[0]?.trim()
    if (candidate) return candidate.slice(0, 128)
  }
  const realIp = req.headers.get("x-real-ip")?.trim()
  if (realIp) return realIp.slice(0, 128)
  return "unknown"
}

export function requestUserAgent(req: Request) {
  return req.headers.get("user-agent")?.slice(0, 255) ?? null
}
