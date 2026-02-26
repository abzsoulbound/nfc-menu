"use client"

import { useMemo } from "react"
import { usePathname } from "next/navigation"
import { BRAND_ASSETS, BRAND_LOCATION, BRAND_MONOGRAM } from "@/lib/brand"
import { contextLabelForPath, resolveUiMode } from "@/lib/ui"

function HeaderLogo({ uiMode }: { uiMode: "customer" | "staff" }) {
  const logoUrl = BRAND_ASSETS.logoUrl
  const usingDefaultLogo =
    logoUrl === "/brand/fable-stores-logo.png" ||
    logoUrl === "/brand/fable-stores-logo.svg"
  const shellClass = uiMode === "staff"
    ? "bg-[rgba(255,255,255,0.08)]"
    : "bg-[rgba(255,255,255,0.72)]"

  if (BRAND_ASSETS.logoUrl) {
    return (
      <div className={`flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-[var(--border)] ${shellClass}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={BRAND_ASSETS.logoUrl}
          alt="Fable Stores logo"
          className={`h-full w-full object-contain object-center p-[3px] ${
            usingDefaultLogo && uiMode === "staff" ? "invert" : ""
          }`}
        />
      </div>
    )
  }

  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface-accent)] text-xs font-semibold tracking-[0.08em]">
      {BRAND_MONOGRAM}
    </div>
  )
}

export function Header() {
  const path = usePathname()
  const uiMode = resolveUiMode(path)
  const context = contextLabelForPath(path)

  const contextHint = useMemo(() => {
    if (uiMode === "staff") return "Operational View"
    return BRAND_LOCATION
  }, [uiMode])

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] surface-primary backdrop-blur">
      <div className="mx-auto flex w-full max-w-[var(--shell-max-width)] items-center justify-between gap-3 px-4 py-3 md:px-6">
        <div className="flex items-center gap-3">
          <HeaderLogo uiMode={uiMode} />
          <div>
            <div className="font-semibold tracking-tight">Fable Stores</div>
            <div className="text-xs text-muted">{contextHint}</div>
          </div>
        </div>

        <div className="status-chip status-chip-neutral">{context}</div>
      </div>
    </header>
  )
}
