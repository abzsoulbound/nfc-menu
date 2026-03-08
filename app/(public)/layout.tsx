import { ReactNode } from "react"
import { AppShell } from "@/components/layout/AppShell"
import { Providers } from "@/app/providers"

export default function PublicLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <Providers>
      <AppShell>
        <div className="page-enter">
          {children}
        </div>
      </AppShell>
    </Providers>
  )
}
