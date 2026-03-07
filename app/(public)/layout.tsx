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
      <AppShell>{children}</AppShell>
    </Providers>
  )
}
