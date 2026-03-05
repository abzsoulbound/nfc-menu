"use client"

import { useEffect, useMemo, useState } from "react"
import { MenuItemCard } from "@/components/menu/MenuItemCard"
import { MenuSection } from "@/components/menu/MenuSection"
import { isCustomerMinimalModeEnabled } from "@/lib/customerMode"
import { getSectionPlaceholderUrl } from "@/lib/placeholders"
import {
  CustomerMenuDiscoveryFlow,
  MenuSection as MenuSectionType,
} from "@/lib/types"

type SearchSectionResult = {
  sectionId: string
  sectionName: string
  imageUrl: string
  items: MenuSectionType["items"]
}

export function MinimalMenuBrowser({
  menu,
  sectionImageMap,
  discoveryFlow = "HERO_FIRST",
  showProgressAnchors = true,
}: {
  menu: MenuSectionType[]
  sectionImageMap?: Record<string, string>
  discoveryFlow?: CustomerMenuDiscoveryFlow
  showProgressAnchors?: boolean
}) {
  const [selectedSectionId, setSelectedSectionId] = useState<
    string | null
  >(menu[0]?.id ?? null)
  const [searchTerm, setSearchTerm] = useState("")

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

  useEffect(() => {
    setSearchTerm("")
  }, [selectedSectionId])

  const selectedSection = useMemo(() => {
    if (menu.length === 0) return null
    return menu.find(section => section.id === selectedSectionId) ?? menu[0]
  }, [menu, selectedSectionId])

  const sectionImageUrl = selectedSection
    ? (
        sectionImageMap?.[selectedSection.id] ??
        getSectionPlaceholderUrl(selectedSection)
      )
    : null
  const showItemCount = !isCustomerMinimalModeEnabled()
  const normalizedSearch = searchTerm.trim().toLowerCase()
  const filteredItems = useMemo(() => {
    if (!selectedSection) return []
    if (!normalizedSearch) return selectedSection.items

    return selectedSection.items.filter(item => {
      const haystack = [
        item.name,
        item.description,
        item.station,
        ...(item.allergens ?? []),
      ]
        .join(" ")
        .toLowerCase()
      return haystack.includes(normalizedSearch)
    })
  }, [normalizedSearch, selectedSection])

  const searchResultsBySection = useMemo<SearchSectionResult[]>(() => {
    if (discoveryFlow !== "SEARCH_FIRST" || !normalizedSearch) {
      return []
    }

    return menu
      .map(section => {
        const items = section.items.filter(item => {
          const haystack = [
            item.name,
            item.description,
            item.station,
            ...(item.allergens ?? []),
          ]
            .join(" ")
            .toLowerCase()
          return haystack.includes(normalizedSearch)
        })
        return {
          sectionId: section.id,
          sectionName: section.name,
          imageUrl:
            sectionImageMap?.[section.id] ??
            getSectionPlaceholderUrl(section),
          items,
        } satisfies SearchSectionResult
      })
      .filter(section => section.items.length > 0)
  }, [
    discoveryFlow,
    menu,
    normalizedSearch,
    sectionImageMap,
  ])

  const globalSearchCount = useMemo(
    () =>
      searchResultsBySection.reduce(
        (sum, section) => sum + section.items.length,
        0
      ),
    [searchResultsBySection]
  )
  const searchingAcrossMenu =
    discoveryFlow === "SEARCH_FIRST" && normalizedSearch !== ""

  if (!selectedSection || !sectionImageUrl) {
    return (
      <div className="rounded-2xl border border-[var(--border)] surface-secondary px-4 py-8 text-center text-sm text-secondary">
        Unavailable.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[var(--border)] bg-[linear-gradient(152deg,rgba(255,251,242,0.96),rgba(246,234,212,0.92))] p-3">
        {showProgressAnchors && (
          <div className="mb-3 flex flex-wrap gap-2">
            <span className="status-chip status-chip-neutral inline-flex">
              Discover
            </span>
            <span className="status-chip status-chip-neutral inline-flex">
              Customize
            </span>
            <span className="status-chip status-chip-neutral inline-flex">
              Review & pay
            </span>
          </div>
        )}

        {discoveryFlow === "SEARCH_FIRST" && (
          <div className="mb-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
            <label className="space-y-1 text-xs uppercase tracking-[0.12em] text-muted">
              Search whole menu
              <input
                type="text"
                value={searchTerm}
                onChange={event => setSearchTerm(event.target.value)}
                placeholder="Try burger, vegan, spicy, lager..."
                className="w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[rgba(255,255,255,0.72)] px-3 py-2 text-sm text-[var(--text-primary)]"
              />
            </label>
            <div className="status-chip status-chip-neutral inline-flex">
              {globalSearchCount} matches
            </div>
          </div>
        )}

        <div className="flex gap-2 overflow-x-auto pb-2">
          {menu.map(section => {
            const active = section.id === selectedSection.id
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => setSelectedSectionId(section.id)}
                className={`focus-ring shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition-all duration-150 ${
                  active
                    ? "border-transparent bg-[var(--accent-action)] text-white shadow-[var(--shadow-soft)]"
                    : "border-[var(--border)] bg-[rgba(255,255,255,0.58)] text-[var(--text-primary)]"
                }`}
              >
                {section.name}
              </button>
            )
          })}
        </div>

        {discoveryFlow !== "SEARCH_FIRST" && (
          <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
            <label className="space-y-1 text-xs uppercase tracking-[0.12em] text-muted">
              Search this section
              <input
                type="text"
                value={searchTerm}
                onChange={event => setSearchTerm(event.target.value)}
                placeholder="Search dishes, drinks, or allergens"
                className="w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[rgba(255,255,255,0.72)] px-3 py-2 text-sm text-[var(--text-primary)]"
              />
            </label>
            <div className="status-chip status-chip-neutral inline-flex">
              {filteredItems.length} of {selectedSection.items.length} shown
            </div>
          </div>
        )}
      </div>

      {searchingAcrossMenu && (
        <div className="space-y-3">
          {searchResultsBySection.length === 0 && (
            <div className="rounded-xl border border-[var(--border)] bg-[rgba(255,255,255,0.66)] px-4 py-6 text-center text-sm text-secondary">
              No items match this search yet. Try a different keyword.
            </div>
          )}

          {searchResultsBySection.map(result => (
            <MenuSection
              key={`search-${result.sectionId}`}
              title={result.sectionName}
              itemCount={result.items.length}
              showItemCount={showItemCount}
              imageUrl={result.imageUrl}
            >
              {result.items.map(item => (
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
          ))}
        </div>
      )}

      {!searchingAcrossMenu && (
      <MenuSection
        key={selectedSection.id}
        title={selectedSection.name}
        itemCount={filteredItems.length}
        showItemCount={showItemCount}
        imageUrl={sectionImageUrl}
      >
        {filteredItems.length === 0 && (
          <div className="rounded-xl border border-[var(--border)] bg-[rgba(255,255,255,0.66)] px-4 py-6 text-center text-sm text-secondary">
            No items match this search yet. Try a different keyword.
          </div>
        )}

        {filteredItems.map(item => (
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
      )}
    </div>
  )
}
