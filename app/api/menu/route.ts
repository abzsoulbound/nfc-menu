import { requireRole } from "@/lib/auth"
import { badRequest, ok, readJson } from "@/lib/http"
import {
  adjustMenuItemStock,
  appendAuditEvent,
  getMenuSnapshot,
  importMenuCsv,
  listAuditEvents,
  renameMenuSection,
  resetMenuToDefault,
  setMenuItemImage,
  setMenuItemStock,
  setMenuItemAvailability,
  updateMenuItem,
} from "@/lib/runtimeStore"
import {
  hydrateRuntimeStateFromDb,
  persistRuntimeStateToDb,
} from "@/lib/runtimePersistence"
import { publishRuntimeEvent } from "@/lib/realtime"
import { withRestaurantRequestContext } from "@/lib/restaurantRequest"
import { Station } from "@/lib/types"

export const dynamic = "force-dynamic"

type MenuPatchBody = {
  action?:
    | "UPDATE_ITEM"
    | "RENAME_SECTION"
    | "RESET_MENU"
    | "SET_ITEM_ACTIVE"
    | "SET_ITEM_IMAGE"
    | "SET_ITEM_STOCK"
    | "ADJUST_ITEM_STOCK"
    | "IMPORT_MENU_CSV"
  itemId?: string
  sectionId?: string
  name?: string
  description?: string
  basePrice?: number
  station?: Station
  active?: boolean
  imageDataUrl?: string | null
  stockCount?: number | null
  delta?: number
  csv?: string
}

function isStation(station: string | undefined): station is Station {
  return station === "KITCHEN" || station === "BAR"
}

export async function GET(req: Request) {
  return withRestaurantRequestContext(req, async () => {
    await hydrateRuntimeStateFromDb()
    const url = new URL(req.url)
    const view = url.searchParams.get("view")
    if (view === "all") {
      try {
        requireRole(["ADMIN"], req)
        return ok(getMenuSnapshot({ includeInactive: true }))
      } catch (error) {
        return badRequest((error as Error).message, 401)
      }
    }

    if (view === "ops") {
      try {
        requireRole(["MANAGER", "ADMIN"], req)
        return ok(getMenuSnapshot({ includeInactive: true }))
      } catch (error) {
        return badRequest((error as Error).message, 401)
      }
    }

    if (view === "audit") {
      try {
        requireRole(["MANAGER", "ADMIN"], req)
        const limitRaw = Number(url.searchParams.get("limit") ?? "100")
        const limit = Number.isFinite(limitRaw) ? limitRaw : 100
        return ok(listAuditEvents(limit))
      } catch (error) {
        return badRequest((error as Error).message, 401)
      }
    }

    return ok(getMenuSnapshot())
  })
}

export async function PATCH(req: Request) {
  return withRestaurantRequestContext(req, async () => {
    try {
      await hydrateRuntimeStateFromDb()
      const body = await readJson<MenuPatchBody>(req)
      if (!body.action) {
        return badRequest("action is required")
      }

    if (body.action === "RESET_MENU") {
      const staff = requireRole(["ADMIN"], req)
      const menu = resetMenuToDefault()
      appendAuditEvent({
        actorRole: staff.role,
        actorId: staff.id,
        action: "RESET_MENU",
        targetType: "MENU",
        targetId: "menu:current",
      })
      await persistRuntimeStateToDb()
      publishRuntimeEvent("menu.updated", { action: "RESET_MENU" })
      return ok({ ok: true, menu })
    }

    if (body.action === "RENAME_SECTION") {
      const staff = requireRole(["ADMIN"], req)
      if (!body.sectionId || typeof body.name !== "string") {
        return badRequest("sectionId and name are required")
      }
      const section = renameMenuSection(body.sectionId, body.name)
      appendAuditEvent({
        actorRole: staff.role,
        actorId: staff.id,
        action: "RENAME_SECTION",
        targetType: "MENU_SECTION",
        targetId: body.sectionId,
        after: { name: section.name },
      })
      await persistRuntimeStateToDb()
      publishRuntimeEvent("menu.updated", {
        action: "RENAME_SECTION",
        sectionId: body.sectionId,
      })
      return ok(section)
    }

    if (body.action === "SET_ITEM_ACTIVE") {
      const staff = requireRole(["MANAGER", "ADMIN"], req)
      if (!body.itemId || typeof body.active !== "boolean") {
        return badRequest("itemId and active are required")
      }
      const item = setMenuItemAvailability(body.itemId, body.active)
      appendAuditEvent({
        actorRole: staff.role,
        actorId: staff.id,
        action: body.active ? "ITEM_ENABLED" : "ITEM_DISABLED",
        targetType: "MENU_ITEM",
        targetId: body.itemId,
        after: { active: body.active },
      })
      await persistRuntimeStateToDb()
      publishRuntimeEvent("menu.updated", {
        action: "SET_ITEM_ACTIVE",
        itemId: body.itemId,
        active: body.active,
      })
      return ok(item)
    }

    if (body.action === "SET_ITEM_IMAGE") {
      const staff = requireRole(["MANAGER", "ADMIN"], req)
      if (!body.itemId) {
        return badRequest("itemId is required")
      }

      if (
        body.imageDataUrl !== null &&
        body.imageDataUrl !== undefined &&
        typeof body.imageDataUrl !== "string"
      ) {
        return badRequest("imageDataUrl must be a string or null")
      }

      const imageDataUrlRaw =
        typeof body.imageDataUrl === "string"
          ? body.imageDataUrl.trim()
          : ""

      if (
        imageDataUrlRaw &&
        !imageDataUrlRaw.startsWith("data:image/")
      ) {
        return badRequest(
          "imageDataUrl must be a data:image payload"
        )
      }
      if (imageDataUrlRaw.length > 2_500_000) {
        return badRequest("imageDataUrl is too large")
      }

      const imageDataUrl = imageDataUrlRaw || null
      const item = setMenuItemImage(body.itemId, imageDataUrl)
      appendAuditEvent({
        actorRole: staff.role,
        actorId: staff.id,
        action: imageDataUrl ? "SET_ITEM_IMAGE" : "CLEAR_ITEM_IMAGE",
        targetType: "MENU_ITEM",
        targetId: body.itemId,
        after: {
          hasImage: imageDataUrl !== null,
        },
      })
      await persistRuntimeStateToDb()
      publishRuntimeEvent("menu.updated", {
        action: "SET_ITEM_IMAGE",
        itemId: body.itemId,
        hasImage: imageDataUrl !== null,
      })
      return ok(item)
    }

    if (body.action === "SET_ITEM_STOCK") {
      const staff = requireRole(["MANAGER", "ADMIN"], req)
      if (!body.itemId) {
        return badRequest("itemId is required")
      }
      if (
        body.stockCount !== null &&
        typeof body.stockCount !== "number"
      ) {
        return badRequest("stockCount must be numeric or null")
      }
      const item = setMenuItemStock(
        body.itemId,
        body.stockCount ?? null
      )
      appendAuditEvent({
        actorRole: staff.role,
        actorId: staff.id,
        action: "SET_ITEM_STOCK",
        targetType: "MENU_ITEM",
        targetId: body.itemId,
        after: { stockCount: item.stockCount ?? null },
      })
      await persistRuntimeStateToDb()
      publishRuntimeEvent("menu.stock", {
        itemId: body.itemId,
        stockCount: item.stockCount ?? null,
      })
      return ok(item)
    }

    if (body.action === "ADJUST_ITEM_STOCK") {
      const staff = requireRole(["MANAGER", "ADMIN"], req)
      if (!body.itemId || typeof body.delta !== "number") {
        return badRequest("itemId and delta are required")
      }
      const item = adjustMenuItemStock(body.itemId, body.delta)
      appendAuditEvent({
        actorRole: staff.role,
        actorId: staff.id,
        action: "ADJUST_ITEM_STOCK",
        targetType: "MENU_ITEM",
        targetId: body.itemId,
        after: {
          delta: body.delta,
          stockCount: item.stockCount ?? null,
        },
      })
      await persistRuntimeStateToDb()
      publishRuntimeEvent("menu.stock", {
        itemId: body.itemId,
        delta: body.delta,
        stockCount: item.stockCount ?? null,
      })
      return ok(item)
    }

    if (body.action === "IMPORT_MENU_CSV") {
      const staff = requireRole(["MANAGER", "ADMIN"], req)
      if (typeof body.csv !== "string" || body.csv.trim() === "") {
        return badRequest("csv is required")
      }

      const menu = importMenuCsv(body.csv)
      const itemCount = menu.reduce(
        (sum, section) => sum + section.items.length,
        0
      )

      appendAuditEvent({
        actorRole: staff.role,
        actorId: staff.id,
        action: "IMPORT_MENU_CSV",
        targetType: "MENU",
        targetId: "menu:current",
        after: {
          sections: menu.length,
          items: itemCount,
        },
      })
      await persistRuntimeStateToDb()
      publishRuntimeEvent("menu.updated", {
        action: "IMPORT_MENU_CSV",
        sections: menu.length,
        items: itemCount,
      })
      return ok({
        ok: true,
        sections: menu.length,
        items: itemCount,
      })
    }

    if (body.action === "UPDATE_ITEM") {
      const staff = requireRole(["ADMIN"], req)
      if (!body.itemId) {
        return badRequest("itemId is required")
      }
      const patch: MenuPatchBody = {}

      if (typeof body.name === "string") patch.name = body.name
      if (typeof body.description === "string") {
        patch.description = body.description
      }
      if (typeof body.basePrice === "number") {
        patch.basePrice = body.basePrice
      }
      if (typeof body.active === "boolean") {
        patch.active = body.active
      }
      if (
        body.stockCount === null ||
        typeof body.stockCount === "number"
      ) {
        patch.stockCount = body.stockCount
      }
      if (typeof body.station === "string") {
        if (!isStation(body.station)) {
          return badRequest("station must be KITCHEN or BAR")
        }
        patch.station = body.station
      }

      const item = updateMenuItem({
        itemId: body.itemId,
        patch,
      })
      appendAuditEvent({
        actorRole: staff.role,
        actorId: staff.id,
        action: "UPDATE_ITEM",
        targetType: "MENU_ITEM",
        targetId: body.itemId,
        after: patch,
      })
      await persistRuntimeStateToDb()
      publishRuntimeEvent("menu.updated", {
        action: "UPDATE_ITEM",
        itemId: body.itemId,
      })
      return ok(item)
    }

      return badRequest("Unsupported action")
    } catch (error) {
      const message = (error as Error).message
      const status = message.startsWith("Unauthorized")
        ? 401
        : 400
      return badRequest(message, status)
    }
  })
}
