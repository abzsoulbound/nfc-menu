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
      className={`p-4 rounded border surface-secondary ${className}`}
    >
      {children}
    </div>
  )
}