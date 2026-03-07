import { HTMLAttributes, ReactNode } from "react"

type CardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode
  variant?: "default" | "elevated" | "accent"
  glass?: boolean
  className?: string
}

export function Card({
  children,
  variant = "default",
  glass = false,
  className = "",
  ...props
}: CardProps) {
  const variantClass: Record<string, string> = {
    default: "surface-secondary card-gradient",
    elevated: "surface-elevated shadow-[var(--shadow-elevated)] card-gradient",
    accent: "surface-accent",
  }

  const glassClass = glass ? "glass-surface" : ""

  return (
    <div
      {...props}
      className={`rounded-[var(--radius-card)] border border-[var(--border-subtle)] p-6 transition-shadow duration-300 hover:shadow-[var(--shadow-elevated)] ${variantClass[variant]} ${glassClass} ${className}`}
    >
      {children}
    </div>
  )
}
