"use client"

import { ReactNode } from "react"
import { usePathname } from "next/navigation"
import { Header } from "@/components/layout/Header"
import { Footer } from "@/components/layout/Footer"
import { resolveUiMode } from "@/lib/ui"

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const uiMode = resolveUiMode(pathname)

  return (
    <div
      className={`app-shell min-h-screen flex flex-col bg-[var(--bg-primary)] text-[var(--text-primary)] ui-${uiMode}`}
    >
      <Header />
      <main className="flex-1">
        {children}
      </main>
      <Footer />
    </div>
  )
}
