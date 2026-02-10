import { ReactNode } from "react"
import { Card } from "@/components/ui/Card"
import { AllergenList } from "@/components/menu/AllergenList"

export function MenuItemCard({
  name,
  description,
  image,
  price,
  vatRate,
  allergens,
  children,
  readOnly = false,
}: {
  name: string
  description: string
  image?: string | null
  price: number
  vatRate: number
  allergens: string[]
  children?: ReactNode
  readOnly?: boolean
}) {
  return (
    <Card>
      <div className="space-y-2">
        <div className="flex justify-between gap-4">
          <div>
            <div className="font-medium">{name}</div>
            <div className="text-sm opacity-70">
              {description}
            </div>
          </div>
          <div className="text-sm">
            £{price.toFixed(2)}
          </div>
        </div>

        <AllergenList allergens={allergens} />

        {!readOnly && children}
      </div>
    </Card>
  )
}