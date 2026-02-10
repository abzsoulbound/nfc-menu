'use client'

import { useState } from "react"
import { MenuSection } from "@/components/menu/MenuSection"
import { MenuItemCard } from "@/components/menu/MenuItemCard"
import { isMenuLocked } from "@/lib/menu"
import { menu as menuData } from "@/lib/menu-data"

export const dynamic = "force-dynamic"

type MenuItem = {
  id: string
  name: string
  description: string
  image: string | null
  basePrice: number
  vatRate: number
  allergens: string[]
}

type MenuSectionType = {
  id: string
  name: string
  items: MenuItem[]
}

export default function PublicMenuPage() {
  const locked = isMenuLocked()
  const menu = menuData as MenuSectionType[]

  const [selectedCategoryId, setSelectedCategoryId] = useState(
    menu.length > 0 ? menu[0].id : null
  )

  const activeSection = menu.find(
    section => section.id === selectedCategoryId
  )

  return (
    <div className="px-4 py-6 space-y-6">
      {locked && (
        <div className="text-sm opacity-70">
          Menu is currently locked during service.
        </div>
      )}

      {/* CATEGORY BAR */}
      <div className="category-bar">
        {menu.map(section => (
          <button
            key={section.id}
            onClick={() => setSelectedCategoryId(section.id)}
            className={
              section.id === selectedCategoryId
                ? "category-pill active"
                : "category-pill"
            }
          >
            {section.name}
          </button>
        ))}
      </div>

      {/* ITEMS */}
      {activeSection && (
        <MenuSection title={activeSection.name}>
          {activeSection.items.map(item => (
            <MenuItemCard
              key={item.id}
              name={item.name}
              description={item.description}
              image={item.image}
              price={item.basePrice}
              vatRate={item.vatRate}
              allergens={item.allergens}
              readOnly
            />
          ))}
        </MenuSection>
      )}

      {menu.length === 0 && (
        <div className="opacity-60 text-center">
          Menu unavailable
        </div>
      )}
    </div>
  )
}
