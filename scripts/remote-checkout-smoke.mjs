import { randomUUID } from "node:crypto"

function usage() {
  console.log(
    [
      "Usage:",
      "  node scripts/remote-checkout-smoke.mjs \\",
      "    --base-url https://example.com \\",
      "    --tenant-slug sales-demo \\",
      "    --admin-passcode 9999",
      "",
      "Optional:",
      "  --table-number 1",
      "  --email smoke@example.com",
      "",
      "Environment variable fallbacks:",
      "  SMOKE_BASE_URL, SMOKE_TENANT_SLUG, SMOKE_ADMIN_PASSCODE,",
      "  SMOKE_TABLE_NUMBER, SMOKE_EMAIL",
      "",
      "The smoke run now requires /api/ops/readiness to return 200 before checkout.",
    ].join("\n")
  )
}

function getEnv(name, required = false) {
  const value = process.env[name]?.trim() ?? ""
  if (required && value === "") {
    throw new Error(`${name} is required.`)
  }
  return value
}

function getArg(flag) {
  const index = process.argv.indexOf(flag)
  if (index < 0) return ""
  return process.argv[index + 1]?.trim() ?? ""
}

function joinUrl(baseUrl, path) {
  return new URL(path, baseUrl).toString()
}

function getSetCookies(response) {
  if (typeof response.headers.getSetCookie === "function") {
    return response.headers.getSetCookie()
  }
  const raw = response.headers.get("set-cookie")
  if (!raw) return []
  return raw.split(/,(?=[^;]+?=)/g)
}

function mergeCookies(current, setCookieValues) {
  const next = new Map(current)
  for (const raw of setCookieValues) {
    const cookie = String(raw).split(";")[0]?.trim() ?? ""
    if (!cookie) continue
    const eqIndex = cookie.indexOf("=")
    if (eqIndex <= 0) continue
    const key = cookie.slice(0, eqIndex).trim()
    next.set(key, cookie)
  }
  return next
}

function cookieHeader(cookieMap) {
  return Array.from(cookieMap.values()).join("; ")
}

async function request(baseUrl, path, options = {}) {
  const response = await fetch(joinUrl(baseUrl, path), {
    method: options.method ?? "GET",
    redirect: options.redirect ?? "manual",
    headers: options.headers,
    body: options.body,
  })

  const text = await response.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = null
  }

  return {
    status: response.status,
    location: response.headers.get("location"),
    setCookies: getSetCookies(response),
    text,
    json,
  }
}

function ensureOk(result, label) {
  if (result.status >= 200 && result.status < 300) {
    return
  }
  const detail =
    result.json?.message ??
    result.json?.error ??
    result.text ??
    `HTTP ${result.status}`
  throw new Error(`${label} failed: ${detail}`)
}

function resolveFirstActiveItem(menuPayload) {
  const menuSections = Array.isArray(menuPayload?.menu)
    ? menuPayload.menu
    : []

  for (const section of menuSections) {
    const items = Array.isArray(section?.items) ? section.items : []
    for (const item of items) {
      const active = item?.active !== false
      const inStock =
        typeof item?.stockCount !== "number" || item.stockCount > 0
      if (active && inStock && item?.id && item?.name && item?.station) {
        return item
      }
    }
  }

  return null
}

async function main() {
  if (process.argv.includes("--help")) {
    usage()
    return
  }

  const baseUrl = (
    getArg("--base-url") || getEnv("SMOKE_BASE_URL", true)
  ).replace(/\/+$/, "")
  const tenantSlug =
    getArg("--tenant-slug") ||
    getEnv("SMOKE_TENANT_SLUG") ||
    getEnv("SALES_DEMO_SLUG") ||
    getEnv("DEFAULT_RESTAURANT_SLUG") ||
    "sales-demo"
  const adminPasscode =
    getArg("--admin-passcode") || getEnv("SMOKE_ADMIN_PASSCODE", true)
  const email =
    getArg("--email") || getEnv("SMOKE_EMAIL") || "smoke@example.com"
  const requestedTableNumberRaw =
    getArg("--table-number") || getEnv("SMOKE_TABLE_NUMBER")
  const requestedTableNumber = requestedTableNumberRaw
    ? Number(requestedTableNumberRaw)
    : null

  let cookies = new Map()

  console.log(`[smoke] Base URL: ${baseUrl}`)
  console.log(`[smoke] Tenant: ${tenantSlug}`)

  const readiness = await request(baseUrl, "/api/ops/readiness")
  if (readiness.status !== 200) {
    const detail =
      readiness.json?.checks ??
      readiness.json?.message ??
      readiness.text ??
      `HTTP ${readiness.status}`
    throw new Error(
      `Readiness check failed before smoke run: ${JSON.stringify(detail)}`
    )
  }

  const tenantSeed = await request(
    baseUrl,
    `/r/${encodeURIComponent(tenantSlug)}?next=/staff-login`
  )
  cookies = mergeCookies(cookies, tenantSeed.setCookies)
  if (
    !(
      tenantSeed.status >= 300 &&
      tenantSeed.status < 400 &&
      tenantSeed.location &&
      tenantSeed.location.includes("/staff-login")
    )
  ) {
    throw new Error("Tenant context seed did not return the expected redirect.")
  }

  const login = await request(baseUrl, "/api/auth/staff", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: cookieHeader(cookies),
    },
    body: JSON.stringify({
      passcode: adminPasscode,
    }),
  })
  ensureOk(login, "Admin login")
  cookies = mergeCookies(cookies, login.setCookies)

  const authRole = login.json?.role
  console.log(`[smoke] Authenticated as: ${authRole ?? "unknown"}`)

  const serviceUnlock = await request(baseUrl, "/api/staff", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: cookieHeader(cookies),
    },
    body: JSON.stringify({
      action: "SERVICE_UNLOCK",
    }),
  })
  ensureOk(serviceUnlock, "Service unlock")

  const tablesResult = await request(baseUrl, "/api/tables", {
    headers: {
      cookie: cookieHeader(cookies),
    },
  })
  ensureOk(tablesResult, "List tables")
  const tables = Array.isArray(tablesResult.json) ? tablesResult.json : []
  if (tables.length === 0) {
    throw new Error("No tables were returned.")
  }

  let table =
    (requestedTableNumber !== null
      ? tables.find(entry => entry.number === requestedTableNumber)
      : null) ??
    tables.find(entry => entry.closed !== true) ??
    tables[0]

  if (!table?.id) {
    throw new Error("Could not select a table.")
  }

  if (table.closed === true) {
    const reopen = await request(baseUrl, "/api/staff", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: cookieHeader(cookies),
      },
      body: JSON.stringify({
        action: "REOPEN_TABLE",
        tableId: table.id,
      }),
    })
    ensureOk(reopen, "Reopen table")
  }

  if (table.locked === true) {
    const unlock = await request(baseUrl, "/api/staff", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: cookieHeader(cookies),
      },
      body: JSON.stringify({
        action: "UNLOCK_TABLE",
        tableId: table.id,
      }),
    })
    ensureOk(unlock, "Unlock table")
  }

  const resetTimer = await request(baseUrl, "/api/staff", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: cookieHeader(cookies),
    },
    body: JSON.stringify({
      action: "RESET_TABLE_TIMER",
      tableId: table.id,
    }),
  })
  ensureOk(resetTimer, "Reset table timer")

  const tableResult = await request(
    baseUrl,
    `/api/tables?tableId=${encodeURIComponent(table.id)}`,
    {
      headers: {
        cookie: cookieHeader(cookies),
      },
    }
  )
  ensureOk(tableResult, "Fetch table detail")
  table = tableResult.json

  if (table.locked || table.stale || table.closed) {
    throw new Error(
      `Table ${table.number} is still not orderable (locked=${table.locked}, stale=${table.stale}, closed=${table.closed}).`
    )
  }

  const menuResult = await request(baseUrl, "/api/menu", {
    headers: {
      cookie: cookieHeader(cookies),
    },
  })
  ensureOk(menuResult, "Fetch menu")

  if (menuResult.json?.locked === true) {
    throw new Error("Menu reports service lock is still enabled.")
  }

  const item = resolveFirstActiveItem(menuResult.json)
  if (!item) {
    throw new Error("No active menu item could be resolved.")
  }

  const tagId = `smoke-${randomUUID().slice(0, 8)}`
  const registerTag = await request(baseUrl, "/api/tags", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: cookieHeader(cookies),
    },
    body: JSON.stringify({ tagId }),
  })
  ensureOk(registerTag, "Register tag")

  const assignTag = await request(baseUrl, "/api/tags", {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      cookie: cookieHeader(cookies),
    },
    body: JSON.stringify({
      tagId,
      tableId: table.id,
    }),
  })
  ensureOk(assignTag, "Assign tag")

  const sessionResult = await request(baseUrl, "/api/sessions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: cookieHeader(cookies),
    },
    body: JSON.stringify({
      origin: "CUSTOMER",
      tagId,
    }),
  })
  ensureOk(sessionResult, "Create session")

  const sessionId = sessionResult.json?.id
  if (!sessionId) {
    throw new Error("Session creation did not return an id.")
  }

  const orderIdempotencyKey = `smoke-order-${randomUUID()}`
  const orderResult = await request(baseUrl, "/api/orders", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: cookieHeader(cookies),
    },
    body: JSON.stringify({
      sessionId,
      tagId,
      idempotencyKey: orderIdempotencyKey,
      items: [
        {
          itemId: item.id,
          name: item.name,
          quantity: 1,
          station: item.station,
          unitPrice: item.basePrice,
          vatRate: item.vatRate,
          allergens: Array.isArray(item.allergens) ? item.allergens : [],
        },
      ],
    }),
  })
  ensureOk(orderResult, "Submit order")

  const quoteResult = await request(
    baseUrl,
    `/api/customer/checkout?tableNumber=${encodeURIComponent(table.number)}`
  )
  ensureOk(quoteResult, "Fetch checkout quote")

  const dueTotal = Number(quoteResult.json?.dueTotal ?? 0)
  if (!Number.isFinite(dueTotal) || dueTotal <= 0) {
    throw new Error("Checkout quote did not produce a positive dueTotal.")
  }

  const checkoutIdempotencyKey = `smoke-checkout-${randomUUID()}`
  const checkoutResult = await request(baseUrl, "/api/customer/checkout", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": checkoutIdempotencyKey,
      cookie: cookieHeader(cookies),
    },
    body: JSON.stringify({
      tableNumber: table.number,
      shareCount: 1,
      amount: dueTotal,
      method: "CARD",
      email,
    }),
  })
  ensureOk(checkoutResult, "Checkout")

  console.log("\nPASS")
  console.log(`- tableNumber: ${table.number}`)
  console.log(`- itemId: ${item.id}`)
  console.log(`- dueTotal: ${dueTotal.toFixed(2)}`)
  console.log(
    `- receiptId: ${checkoutResult.json?.receipt?.receiptId ?? "unknown"}`
  )
}

main().catch(error => {
  console.error(`FAIL: ${(error && error.message) || String(error)}`)
  process.exit(1)
})
