"use client"

import { usePathname } from "next/navigation"
import {
  isCustomerMinimalModeEnabled,
  showCustomerDebugLabels,
} from "@/lib/customerMode"
import { useSessionStore } from "@/store/useSessionStore"
import { resolveUiMode } from "@/lib/ui"

export function Footer() {
  const sessionId = useSessionStore(s => s.sessionId)
  const path = usePathname()
  const uiMode = resolveUiMode(path)
  const customerMinimalMode = isCustomerMinimalModeEnabled()
  const showDebugSession = showCustomerDebugLabels()

  return (
    <footer className="border-t border-[var(--border)] surface-primary">
      <div className="mx-auto flex w-full max-w-[var(--shell-max-width)] items-center justify-between gap-3 px-4 py-3 text-xs text-muted md:px-6">
        <div>
          {uiMode === "staff"
            ? "Operations"
            : customerMinimalMode
            ? "Fable Stores"
            : "Editorial warm"}
        </div>
        <div>
          {showDebugSession
            ? sessionId
              ? `Session ${sessionId.slice(0, 8)}`
              : "No session"
            : " "}
        </div>
      </div>
    </footer>
  )
}
