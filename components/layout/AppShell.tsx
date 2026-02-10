import { ReactNode } from "react"
import { Header } from "@/components/layout/Header"
import { Footer } from "@/components/layout/Footer"

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col surface-primary">
      <Header />
      <main className="flex-1 surface-secondary">
        {children}
      </main>
      <Footer />
    </div>
  )
}
