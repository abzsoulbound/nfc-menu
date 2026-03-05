"use client"

import { useId } from "react"
import { Badge } from "@/components/ui/Badge"

export function AllergenList({
  allergens,
  introduced = [],
  collapsible = false,
  compactLabel = "Allergens",
}: {
  allergens: string[]
  introduced?: string[]
  collapsible?: boolean
  compactLabel?: string
}) {
  const detailsId = useId()

  if (allergens.length === 0) return null

  if (collapsible) {
    return (
      <details className="mt-1">
        <summary
          className="cursor-pointer text-xs text-secondary"
          aria-controls={detailsId}
        >
          {compactLabel}
        </summary>
        <div id={detailsId} className="mt-1 flex flex-wrap gap-1">
          {allergens.map(a => {
            const isNew = introduced.includes(a)
            return (
              <Badge key={a}>
                {a}
                {isNew ? " +" : ""}
              </Badge>
            )
          })}
        </div>
      </details>
    )
  }

  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {allergens.map(a => {
        const isNew = introduced.includes(a)
        return (
          <Badge key={a}>
            {a}{isNew ? " +" : ""}
          </Badge>
        )
      })}
    </div>
  )
}
