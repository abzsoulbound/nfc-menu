import { HTMLAttributes, ReactNode } from "react"

type CardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode
  variant?: "default" | "elevated" | "accent"
  glass?: boolean
  gradient?: boolean
  className?: string
}

export function Card({
  children,
  variant = "default",
  glass = false,
  gradient = false,
  className = "",
  ...props
}: CardProps) {
  const variantBase: Record<string, string> = {
    default: "surface-secondary",
    elevated: "surface-elevated shadow-[var(--shadow-elevated)]",
    accent: "surface-accent",
  }

  const gradientClass = ""
  const glassClass = glass ? "glass-surface" : ""

  return (
    <div
      {...props}
      className={`brand-card rounded-[var(--radius-card)] border border-[var(--border-subtle)] p-6 transition-shadow duration-300 hover:shadow-[var(--shadow-elevated)] ${variantBase[variant]} ${gradientClass} ${glassClass} ${className}`}
    >
      {children}
    </div>
  )
}
