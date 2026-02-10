import { ReactNode } from "react"
import { Divider } from "@/components/ui/Divider"

export function MenuSection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="space-y-3">
      <div className="text-lg font-semibold">
        {title}
      </div>

      <Divider />

      <div className="space-y-3">
        {children}
      </div>
    </section>
  )
}