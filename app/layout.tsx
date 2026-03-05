import "@/app/globals.css"
import type { Metadata } from "next"
import { ReactNode } from "react"
import {
  Cormorant_Garamond,
  JetBrains_Mono,
  Manrope,
} from "next/font/google"
import { Providers } from "@/app/providers"
import { AppShell } from "@/components/layout/AppShell"
import { validateRequiredEnv } from "@/lib/env"
import { PUBLIC_SITE_NAME, PUBLIC_SITE_SUMMARY } from "@/lib/publicSite"

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

export const metadata: Metadata = {
  metadataBase: new URL("https://soulboundstudios.com"),
  title: {
    default: PUBLIC_SITE_NAME,
    template: `%s | ${PUBLIC_SITE_NAME}`,
  },
  description: PUBLIC_SITE_SUMMARY,
}

function shouldValidateEnvAtRuntime() {
  return process.env.NEXT_PHASE !== "phase-production-build"
}

export default async function RootLayout({
  children,
}: {
  children: ReactNode
}) {
  if (shouldValidateEnvAtRuntime()) {
    validateRequiredEnv()
  }

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
