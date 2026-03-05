import { requireRole } from "@/lib/auth"
import { badRequest, ok, readJson } from "@/lib/http"
import {
  appendAuditEvent,
  importMenuCsv,
  previewMenuCsvImport,
} from "@/lib/runtimeStore"
import {
  hydrateRuntimeStateFromDb,
  persistRuntimeStateToDb,
} from "@/lib/runtimePersistence"
import { publishRuntimeEvent } from "@/lib/realtime"
import { withRestaurantRequestContext } from "@/lib/restaurantRequest"

export const dynamic = "force-dynamic"

type Body = {
  csv?: string
  dryRun?: boolean
}

export async function POST(req: Request) {
  return withRestaurantRequestContext(req, async () => {
    try {
      const staff = requireRole(["MANAGER", "ADMIN"], req)
      await hydrateRuntimeStateFromDb()
      const body = await readJson<Body>(req)
      const csv = body.csv?.trim() ?? ""
      if (!csv) {
        return badRequest("csv is required", 400, {
          code: "MENU_IMPORT_CSV_REQUIRED",
          req,
        })
      }

      const preview = previewMenuCsvImport(csv)
      if (body.dryRun) {
        return ok(
          {
            ok: true,
            dryRun: true,
            ...preview,
          },
          undefined,
          req
        )
      }

      const menu = importMenuCsv(csv)
      appendAuditEvent({
        actorRole: staff.role,
        actorId: staff.id,
        action: "IMPORT_MENU_CSV",
        targetType: "MENU",
        targetId: "menu:current",
        after: {
          sectionCount: preview.sectionCount,
          itemCount: preview.itemCount,
        },
      })

      await persistRuntimeStateToDb()
      publishRuntimeEvent("menu.updated", {
        action: "IMPORT_MENU_CSV",
        sectionCount: preview.sectionCount,
        itemCount: preview.itemCount,
      })

      return ok(
        {
          ok: true,
          dryRun: false,
          sectionCount: preview.sectionCount,
          itemCount: preview.itemCount,
          sections: preview.sections,
          menu,
        },
        undefined,
        req
      )
    } catch (error) {
      const message = (error as Error).message
      return badRequest(message, message.startsWith("Unauthorized") ? 401 : 400, {
        code: message.startsWith("Unauthorized")
          ? "UNAUTHORIZED"
          : "MENU_IMPORT_CSV_FAILED",
        req,
      })
    }
  })
}
