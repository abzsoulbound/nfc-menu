import "@/app/globals.css"
import { ReactNode } from "react"
import { Providers } from "@/app/providers"
import { AppShell } from "@/components/layout/AppShell"
import { Analytics } from "@vercel/analytics/next"

export default function RootLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <AppShell>
            {children}
          </AppShell>
        </Providers>
        <Analytics />
      </body>
    </html>
  )
}
