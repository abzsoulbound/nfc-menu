import { StatusChipVariant } from "@/lib/types"

export function Badge({
  children,
  variant = "neutral",
}: {
  children: React.ReactNode
  variant?: StatusChipVariant
}) {
  const tone: Record<StatusChipVariant, string> = {
    neutral: "status-chip-neutral",
    success: "status-chip-success",
    warning: "status-chip-warning",
    danger: "status-chip-danger",
  }

  return (
    <span className={`status-chip ${tone[variant]}`}>
      {children}
    </span>
  )
}
