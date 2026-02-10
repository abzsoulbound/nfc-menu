"use client"

import { Badge } from "@/components/ui/Badge"

export function AllergenList({
  allergens,
  introduced = [],
}: {
  allergens: string[]
  introduced?: string[]
}) {
  if (allergens.length === 0) return null

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