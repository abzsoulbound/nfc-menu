"use client"

import { usePathname } from "next/navigation"
import { Card } from "@/components/ui/Card"

export function Header() {
  const path = usePathname()

  let context = "Menu"
  if (path.startsWith("/staff")) context = "Staff"
  if (path.startsWith("/kitchen")) context = "Kitchen"
  if (path.startsWith("/bar")) context = "Bar"
  if (path.startsWith("/t/")) context = "Order"

  return (
    <header className="surface-primary border-b">
      <Card>
        <div className="flex justify-between items-center">
          <div className="font-semibold">
            Marlo’s
          </div>
          <div className="text-sm opacity-70">
            {context}
          </div>
        </div>
      </Card>
    </header>
  )
}