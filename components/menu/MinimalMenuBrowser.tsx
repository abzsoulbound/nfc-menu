"use client"

import { useEffect, useState } from "react"
import { MenuItemCard } from "@/components/menu/MenuItemCard"
import { MenuSection } from "@/components/menu/MenuSection"
import { isCustomerMinimalModeEnabled } from "@/lib/customerMode"
import { getSectionPlaceholderUrl } from "@/lib/placeholders"
import { MenuSection as MenuSectionType } from "@/lib/types"

export function MinimalMenuBrowser({
  menu,
  sectionImageMap,
}: {
  menu: MenuSectionType[]
  sectionImageMap?: Record<string, string>
}) {
  const [selectedSectionId, setSelectedSectionId] = useState<
    string | null
  >(menu[0]?.id ?? null)

  useEffect(() => {
    if (menu.length === 0) {
      setSelectedSectionId(null)
      return
    }
    setSelectedSectionId(prev => {
      if (prev && menu.some(section => section.id === prev)) {
        return prev
      }
      return menu[0].id
    })
  }, [menu])

  if (menu.length === 0) {
    return (
      <div className="rounded-2xl border border-[var(--border)] surface-secondary px-4 py-8 text-center text-sm text-secondary">
        Unavailable.
      </div>
    )
  }

  const selectedSection =
    menu.find(section => section.id === selectedSectionId) ?? menu[0]
  const sectionImageUrl =
    sectionImageMap?.[selectedSection.id] ??
    getSectionPlaceholderUrl(selectedSection)
  const showItemCount = !isCustomerMinimalModeEnabled()

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[var(--border)] surface-secondary p-3">
        <div className="flex flex-wrap gap-2">
          {menu.map(section => {
            const active = section.id === selectedSection.id
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => setSelectedSectionId(section.id)}
                className={`focus-ring rounded-full border px-3 py-1.5 text-xs font-semibold transition-all duration-150 ${
                  active
                    ? "border-transparent bg-[var(--accent-action)] text-white"
                    : "border-[var(--border)] bg-transparent text-[var(--text-primary)]"
                }`}
              >
                {section.name}
              </button>
            )
          })}
        </div>
      </div>

      <MenuSection
        key={selectedSection.id}
        title={selectedSection.name}
        itemCount={selectedSection.items.length}
        showItemCount={showItemCount}
        imageUrl={sectionImageUrl}
      >
        {selectedSection.items.map(item => (
          <MenuItemCard
            key={item.id}
            name={item.name}
            description={item.description}
            image={item.image}
            price={item.basePrice}
            vatRate={item.vatRate}
            allergens={item.allergens}
            station={item.station}
            editableOptions={item.editableOptions}
            variant="menu"
            readOnly
          />
        ))}
      </MenuSection>
    </div>
  )
}
