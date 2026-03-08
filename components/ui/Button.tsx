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
  variant: _variant = "primary",
  className = "",
}: {
  children: ReactNode
  onClick?: MouseEventHandler<HTMLButtonElement>
  disabled?: boolean
  variant?: ButtonVariant
  className?: string
}) {
  const base = "focus-ring btn-press action-surface action-button"

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      type="button"
      className={`${base} ${disabled ? "cursor-not-allowed opacity-50" : ""} ${className}`}
    >
      {children}
    </button>
  )
}
