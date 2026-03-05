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
      className="scroll-mt-28 rounded-2xl border border-[var(--border)] surface-secondary p-4 md:p-6"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          {index !== undefined && (
            <div className="text-[10px] uppercase tracking-[0.28em] text-muted">
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
        className="mt-4 h-32 w-full rounded-xl border border-[var(--border)] bg-cover bg-center"
        style={{ backgroundImage: `url("${resolvedImageUrl}")` }}
      />

      <Divider />

      <div className="space-y-3 md:space-y-4">
        {children}
      </div>
    </section>
  )
}
