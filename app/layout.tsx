import "@/app/globals.css"
import { ReactNode } from "react"
import {
  Cormorant_Garamond,
  JetBrains_Mono,
  Manrope,
} from "next/font/google"
import { Providers } from "@/app/providers"
import { AppShell } from "@/components/layout/AppShell"
import { validateRequiredEnv } from "@/lib/env"

const uiFont = Manrope({
  subsets: ["latin"],
  variable: "--font-ui",
  weight: ["400", "500", "600", "700"],
})

const displayFont = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["600", "700"],
})

const monoFont = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["500", "600"],
})

export default function RootLayout({
  children,
}: {
  children: ReactNode
}) {
  validateRequiredEnv()

  return (
    <html
      lang="en"
      className={`${uiFont.variable} ${displayFont.variable} ${monoFont.variable}`}
    >
      <body>
        <Providers>
          <AppShell>
            {children}
          </AppShell>
        </Providers>
      </body>
    </html>
  )
}
