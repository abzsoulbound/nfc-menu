"use client"

import { MouseEventHandler, ReactNode } from "react"

export function Button({
  children,
  onClick,
  type = "button",
  disabled,
  variant = "primary",
  className = "",
}: {
  children: ReactNode
  onClick?: MouseEventHandler<HTMLButtonElement>
  type?: "button" | "submit" | "reset"
  disabled?: boolean
  variant?: "primary" | "secondary" | "destructive"
  className?: string
}) {
  const base = "px-3 py-2 rounded text-sm font-medium focus-ring"
  const variants: Record<string, string> = {
    primary: "btn-primary",
    secondary: "btn-secondary",
    destructive: "btn-destructive",
  }

  return (
    <button
      type={type}
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
