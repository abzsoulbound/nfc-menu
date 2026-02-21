import "@/app/globals.css"
import { ReactNode } from "react"
import { Fraunces, Plus_Jakarta_Sans } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { Providers } from "@/app/providers"
import { AppShell } from "@/components/layout/AppShell"

const serif = Fraunces({
  subsets: ["latin"],
  variable: "--font-serif",
  weight: ["400", "600"],
})

const sans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "600"],
})

export default function RootLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${serif.variable} ${sans.variable}`}>
        <Providers>
          <AppShell>
            {children}
          </AppShell>
          <Analytics />
        </Providers>
      </body>
    </html>
  )
}
