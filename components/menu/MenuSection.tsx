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
    <section className="menu-section">
      <div className="menu-section-head">
        <h2 className="menu-section-title">{title}</h2>
        <Divider />
      </div>
      <div className="menu-section-grid">{children}</div>
    </section>
  )
}
