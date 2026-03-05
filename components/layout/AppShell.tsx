"use client"

import { ReactNode, useMemo } from "react"
import { usePathname } from "next/navigation"
import { Header } from "@/components/layout/Header"
import { Footer } from "@/components/layout/Footer"
import { resolveUiMode } from "@/lib/ui"
import { buildThemeVars } from "@/lib/restaurantTheme"
import { useRestaurantStore } from "@/store/useRestaurantStore"

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const uiMode = resolveUiMode(pathname)
  const theme = useRestaurantStore(
    s => s.experienceConfig.theme
  )
  const dynamicThemeVars = useMemo(
    () => buildThemeVars({ theme, uiMode }),
    [theme, uiMode]
  )

  return (
    <div
      className={`app-shell min-h-screen flex flex-col bg-[var(--bg-primary)] text-[var(--text-primary)] ui-${uiMode}`}
      style={dynamicThemeVars}
    >
      <Header />
      <main className="flex-1">
        {children}
      </main>
      <Footer />
    </div>
  )
}
