"use client"

import { MouseEventHandler, ReactNode } from "react"

export function Button({
  children,
  onClick,
  disabled,
  variant = "primary",
  className = "",
}: {
  children: ReactNode
  onClick?: MouseEventHandler<HTMLButtonElement>
  disabled?: boolean
  variant?: "primary" | "secondary" | "destructive"
  className?: string
}) {
  const base =
    "px-3 py-2 rounded text-sm font-medium focus-ring"
  const variants: Record<string, string> = {
    primary:
      "bg-[var(--accent-action)] text-primary",
    secondary:
      "bg-[var(--bg-accent)] text-primary",
    destructive:
      "bg-[var(--chip-active)] text-primary",
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${variants[variant]} ${
        disabled ? "opacity-50" : ""
      } ${className}`}
    >
      {children}
    </button>
  )
}
