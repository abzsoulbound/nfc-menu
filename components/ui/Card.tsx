import { ReactNode } from "react"

export function Card({
  children,
  className = "",
  ...props
}: {
  children: ReactNode
  className?: string
  [key: string]: any
}) {
  return (
    <div
      {...props}
      className={`card ${className}`}
    >
      {children}
    </div>
  )
}
