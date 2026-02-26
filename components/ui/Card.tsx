import { HTMLAttributes, ReactNode } from "react"

type CardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode
  variant?: "default" | "elevated" | "accent"
  className?: string
}

export function Card({
  children,
  variant = "default",
  className = "",
  ...props
}: CardProps) {
  const variantClass: Record<string, string> = {
    default: "surface-secondary",
    elevated: "surface-elevated shadow-[var(--shadow-soft)]",
    accent: "surface-accent",
  }

  return (
    <div
      {...props}
      className={`rounded-[var(--radius-card)] border border-[var(--border)] p-4 ${variantClass[variant]} ${className}`}
    >
      {children}
    </div>
  )
}
