"use client"

import { MouseEventHandler, ReactNode } from "react"
export type ButtonVariant =
  | "primary"
  | "secondary"
  | "danger"
  | "destructive"
  | "ghost"
  | "quiet"

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
  variant?: ButtonVariant
  className?: string
}) {
  const base =
    "focus-ring btn-press inline-flex min-h-[44px] items-center justify-center rounded-[var(--radius-control)] border px-4 py-2.5 text-sm font-semibold transition-all duration-150"

  const variants: Record<ButtonVariant, string> = {
    primary:
      "border-transparent bg-[var(--accent-action)] text-white hover:bg-[var(--accent-action-strong)]",
    secondary:
      "border-[var(--border)] bg-[var(--surface-accent)] text-[var(--text-primary)] hover:opacity-90",
    danger:
      "border-[var(--danger-fg)] bg-[var(--danger-bg)] text-[var(--danger-fg)] hover:opacity-90",
    destructive:
      "border-[var(--danger-fg)] bg-[var(--danger-bg)] text-[var(--danger-fg)] hover:opacity-90",
    ghost:
      "border-transparent bg-transparent text-[var(--text-primary)] hover:bg-[var(--surface-accent)]",
    quiet:
      "border-[var(--border)] bg-[var(--accent-quiet)] text-[var(--text-primary)] hover:opacity-90",
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      type="button"
      className={`${base} ${variants[variant]} ${
        disabled ? "cursor-not-allowed opacity-50" : ""
      } ${className}`}
    >
      {children}
    </button>
  )
}
