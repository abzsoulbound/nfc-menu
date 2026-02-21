"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { resolveItemDescription } from "@/lib/itemDescriptions"

export type ProductOption = {
  id: string
  name: string
  priceDelta: number
  image?: string | null
  sourceGroupId?: string
  sourceOptionId?: string
}

export type ProductOptionGroup = {
  id: string
  title: string
  required: boolean
  multiSelect: boolean
  type: "single" | "multi" | "adjustable"
  min?: number
  max?: number
  actionLabel?: string
  options: ProductOption[]
}

type Props = {
  item: {
    id: string
    name: string
    description: string
    image: string | null
    basePrice: number
  }
  quantity: number
  groups: ProductOptionGroup[]
  selections: Record<string, string[]>
  requiredRemaining: number
  customizerError: string | null
  totalPrice: number
  onClose: () => void
  onToggleOption: (
    groupId: string,
    optionId: string,
    selected: boolean
  ) => void
  onQuantityChange: (nextQty: number) => void
  onAddToBasket: () => void
  addDisabled: boolean
}

function formatDelta(value: number): string {
  if (value === 0) return "Included"
  const sign = value > 0 ? "+" : ""
  return `${sign}£${value.toFixed(2)}`
}

function groupConstraintCopy(group: ProductOptionGroup): string {
  if (group.type === "single") {
    return group.required ? "Choose 1 required option" : "Choose up to 1 option"
  }

  const max =
    typeof group.max === "number" && group.max > 0
      ? group.max
      : group.options.length
  const min =
    typeof group.min === "number" && group.min >= 0
      ? group.min
      : group.required
      ? 1
      : 0

  if (min === 0) return `Choose up to ${max}`
  if (min === max) return `Choose ${min}`
  return `Choose ${min}-${max}`
}

function isGroupSatisfied(group: ProductOptionGroup, selectedIds: string[]): boolean {
  if (!group.required) return true

  if (group.type === "single") {
    return selectedIds.length === 1
  }

  if (group.type === "multi") {
    const min = typeof group.min === "number" && group.min > 0 ? group.min : 1
    return selectedIds.length >= min
  }

  return selectedIds.length >= 1
}

function OptionIndicator({
  groupType,
  selected,
}: {
  groupType: ProductOptionGroup["type"]
  selected: boolean
}) {
  if (groupType === "multi") {
    return (
      <span
        aria-hidden="true"
        className={`product-detail-indicator product-detail-indicator--multi${
          selected ? " is-active" : ""
        }`}
      >
        {selected ? "✓" : ""}
      </span>
    )
  }

  return (
    <span
      aria-hidden="true"
      className={`product-detail-indicator product-detail-indicator--single${
        selected ? " is-active" : ""
      }`}
    >
      <span className="product-detail-indicator-dot" />
    </span>
  )
}

export function ProductDetail({
  item,
  quantity,
  groups,
  selections,
  requiredRemaining,
  customizerError,
  totalPrice,
  onClose,
  onToggleOption,
  onQuantityChange,
  onAddToBasket,
  addDisabled,
}: Props) {
  const [flashInvalidId, setFlashInvalidId] = useState<string | null>(null)
  const [blockedGroupId, setBlockedGroupId] = useState<string | null>(null)
  const groupRefs = useRef<Record<string, HTMLDivElement | null>>({})

  useEffect(() => {
    setFlashInvalidId(null)
    setBlockedGroupId(null)
  }, [item.id])

  const firstInvalidGroupId = useMemo(() => {
    for (const group of groups) {
      const selectedIds = selections[group.id] ?? []
      if (!isGroupSatisfied(group, selectedIds)) {
        return group.id
      }
    }
    return null
  }, [groups, selections])

  const handleAddClick = () => {
    if (firstInvalidGroupId) {
      const node = groupRefs.current[firstInvalidGroupId]
      node?.scrollIntoView({ block: "center", behavior: "smooth" })
      setFlashInvalidId(firstInvalidGroupId)
      window.setTimeout(() => setFlashInvalidId(null), 750)
      return
    }

    onAddToBasket()
  }

  const imagePlaceholder = "/images/replace.png"
  const normalizedImage = typeof item.image === "string" ? item.image.trim() : ""
  const isPlaceholderImage =
    normalizedImage.length === 0 ||
    normalizedImage.endsWith(imagePlaceholder) ||
    normalizedImage.endsWith("/images/marlos-logo.png") ||
    normalizedImage.endsWith("/images/marlos-wordmark.png") ||
    normalizedImage.endsWith("/images/marlos-wordmark-alpha.svg") ||
    normalizedImage.endsWith("/images/marlos-wordmark-alpha-tight.png")
  const imageSrc = isPlaceholderImage ? imagePlaceholder : normalizedImage
  const resolvedDescription = resolveItemDescription(item.name, item.description)

  return (
    <div className="product-detail-shell">
      <header className="product-detail-header">
        <button
          type="button"
          onClick={onClose}
          className="product-detail-back"
        >
          Back to Menu
        </button>
        <span className="product-detail-brand">Fable Stores</span>
      </header>

      <div className="product-detail-body">
        <section className="product-detail-hero">
          <div className="product-detail-image-wrap">
            <img
              src={imageSrc}
              alt={item.name}
              className={`product-detail-image${
                isPlaceholderImage ? " product-detail-image--placeholder" : ""
              }`}
              onError={event => {
                if (!event.currentTarget.src.includes(imagePlaceholder)) {
                  event.currentTarget.src = imagePlaceholder
                }
              }}
            />
          </div>

          <div className="product-detail-meta">
            <p className="product-detail-kicker">Signature Menu Item</p>
            <h1 className="product-detail-title">{item.name}</h1>
            <p className="product-detail-description-label">Description</p>
            <p className="product-detail-description">{resolvedDescription}</p>
          </div>
        </section>

        {groups.length > 0 && (
          <section className="product-detail-options" aria-label="Options">
            {groups.map(group => {
              const selectedIds = selections[group.id] ?? []
              const isInvalid =
                flashInvalidId === group.id ||
                !isGroupSatisfied(group, selectedIds)
              const selectedCount = selectedIds.length

              return (
                <div
                  key={group.id}
                  ref={node => {
                    groupRefs.current[group.id] = node
                  }}
                  className={`product-detail-group${
                    isInvalid ? " is-invalid" : ""
                  }`}
                >
                  <div className="product-detail-group-head">
                    <div>
                      <h3 className="product-detail-group-title">{group.title}</h3>
                      <p className="product-detail-group-meta">
                        {group.required ? "Required" : "Optional"} •{" "}
                        {groupConstraintCopy(group)}
                      </p>
                    </div>
                    <div className="product-detail-group-badges">
                      <span className="product-detail-selected-count">
                        {selectedCount} chosen
                      </span>
                      {blockedGroupId === group.id && (
                        <span className="product-detail-max-badge">Max reached</span>
                      )}
                    </div>
                  </div>

                  <div className="product-detail-option-list">
                    {group.options.map(option => {
                      const selected = selectedIds.includes(option.id)

                      const onClick = () => {
                        if (group.type === "single") {
                          onToggleOption(group.id, option.id, true)
                          return
                        }

                        if (group.type === "adjustable") {
                          onToggleOption(group.id, option.id, !selected)
                          return
                        }

                        const nextValue = !selected
                        const max =
                          typeof group.max === "number" && group.max > 0
                            ? group.max
                            : null

                        if (
                          nextValue &&
                          max !== null &&
                          selectedIds.length >= max
                        ) {
                          setBlockedGroupId(group.id)
                          window.setTimeout(() => setBlockedGroupId(null), 700)
                          return
                        }

                        onToggleOption(group.id, option.id, nextValue)
                      }

                      return (
                        <button
                          key={option.id}
                          type="button"
                          role={group.type === "multi" ? "checkbox" : "radio"}
                          aria-checked={selected}
                          onClick={onClick}
                          className={`product-detail-option-row${
                            selected ? " is-active" : ""
                          }`}
                        >
                          <span className="product-detail-option-name">
                            {option.name}
                          </span>
                          <span className="product-detail-option-price">
                            {formatDelta(option.priceDelta)}
                          </span>
                          <OptionIndicator
                            groupType={group.type}
                            selected={selected}
                          />
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </section>
        )}

        <section className="product-detail-qty">
          <div className="product-detail-qty-head">
            <span className="product-detail-qty-title">Quantity</span>
            <div className="product-detail-qty-controls">
              <button
                type="button"
                onClick={() => onQuantityChange(Math.max(1, quantity - 1))}
                disabled={quantity <= 1}
                aria-label="Decrease quantity"
                className="product-detail-qty-btn"
              >
                −
              </button>
              <span className="product-detail-qty-value">{quantity}</span>
              <button
                type="button"
                onClick={() => onQuantityChange(Math.min(20, quantity + 1))}
                aria-label="Increase quantity"
                className="product-detail-qty-btn"
              >
                +
              </button>
            </div>
          </div>
        </section>

        {customizerError && (
          <div className="product-detail-error">{customizerError}</div>
        )}

        {requiredRemaining > 0 && (
          <div className="product-detail-error">
            Select required options in {requiredRemaining}{" "}
            {requiredRemaining === 1 ? "group" : "groups"} before adding.
          </div>
        )}
      </div>

      <footer className="product-detail-footer">
        <div className="product-detail-footer-row">
          <button
            type="button"
            onClick={onClose}
            className="product-detail-footer-back"
          >
            Back to Menu
          </button>
          <button
            type="button"
            onClick={handleAddClick}
            disabled={addDisabled}
            className="product-detail-footer-add"
          >
            Add to Order (£{totalPrice.toFixed(2)})
          </button>
        </div>
      </footer>
    </div>
  )
}
