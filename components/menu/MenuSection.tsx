import { ReactNode } from "react"
import { Divider } from "@/components/ui/Divider"
import { AI_PLACEHOLDER_SECTION_MIXED_URL } from "@/lib/placeholders"

export function MenuSection({
  id,
  title,
  itemCount,
  showItemCount = true,
  index,
  imageUrl,
  children,
}: {
  id?: string
  title: string
  itemCount: number
  showItemCount?: boolean
  index?: number
  imageUrl?: string
  children: ReactNode
}) {
  const resolvedImageUrl =
    typeof imageUrl === "string" && imageUrl.trim() !== ""
      ? imageUrl
      : AI_PLACEHOLDER_SECTION_MIXED_URL

  return (
    <section
      id={id}
      className="scroll-mt-28 rounded-2xl border border-[var(--border-subtle)] surface-secondary p-5 md:p-8"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          {index !== undefined && (
            <div className="text-[11px] uppercase tracking-[0.28em] text-muted">
              Section {String(index).padStart(2, "0")}
            </div>
          )}
          <h2 className="display-font text-3xl tracking-tight text-[var(--text-primary)] md:text-4xl">
            {title}
          </h2>
        </div>

        {showItemCount && (
          <div className="status-chip status-chip-neutral">
            {itemCount} items
          </div>
        )}
      </div>

      <div
        aria-label={`${title} section image`}
        className="mt-5 h-36 w-full rounded-xl border border-[var(--border-subtle)] bg-cover bg-center shadow-[var(--shadow-soft)]"
        style={{ backgroundImage: `url("${resolvedImageUrl}")` }}
      />

      <Divider />

      <div className="space-y-4 md:space-y-5">
        {children}
      </div>
    </section>
  )
}
