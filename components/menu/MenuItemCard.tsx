'use client'

import { ReactNode } from "react"

type Props = {
  name: string
  description?: string
  image?: string | null
  price: number
  vatRate?: number
  allergens?: string[]
  children?: ReactNode
  quantity?: number
  onIncrease?: () => void
  onDecrease?: () => void
  controlsDisabled?: boolean
  showEditButton?: boolean
  onEdit?: () => void
  editDisabled?: boolean
  onClick?: () => void
  mode?: "pill" | "editor"
}

export function MenuItemCard({
  name,
  description,
  image,
  price,
  children,
  quantity,
  onIncrease,
  onDecrease,
  allergens = [],
  controlsDisabled = false,
  showEditButton = false,
  onEdit,
  editDisabled = false,
  onClick,
  mode = "pill",
}: Props) {
  const fallbackImage = "/images/replace.png"
  const imageSrc = image || fallbackImage
  const resolvedQuantity = typeof quantity === "number" ? quantity : 0

  const minusDisabled =
    controlsDisabled || !onDecrease || resolvedQuantity <= 0
  const plusDisabled = controlsDisabled || !onIncrease
  const resolvedEditDisabled =
    controlsDisabled || editDisabled || !onEdit
  const allergenCopy =
    allergens.length > 0
      ? `Allergens: ${allergens.join(", ")}`
      : "Allergens: none"

  const stepper = (
    <div className="menu-qty">
      <button
        className="menu-qty-btn"
        type="button"
        aria-label={`Decrease ${name} quantity`}
        onClick={event => {
          event.stopPropagation()
          onDecrease?.()
        }}
        disabled={minusDisabled}
      >
        −
      </button>
      <div className="menu-qty-value">{resolvedQuantity}</div>
      <button
        className="menu-qty-btn"
        type="button"
        aria-label={`Increase ${name} quantity`}
        onClick={event => {
          event.stopPropagation()
          onIncrease?.()
        }}
        disabled={plusDisabled}
      >
        +
      </button>
      {showEditButton && (
        <button
          className="menu-edit-btn"
          type="button"
          aria-label={`Edit ${name}`}
          onClick={event => {
            event.stopPropagation()
            onEdit?.()
          }}
          disabled={resolvedEditDisabled}
        >
          Edit
        </button>
      )}
    </div>
  )

  if (mode === "editor") {
    return (
      <div className="menu-item menu-item--editor">
        <div className="menu-item-header">
          <h3 className="menu-item-name">{name}</h3>
          <div className="menu-item-price">£{price.toFixed(2)}</div>
        </div>

        {description && (
          <p className="menu-item-desc">{description}</p>
        )}
        <p className="menu-item-allergens">{allergenCopy}</p>

        {children ??
          (typeof quantity === "number" &&
          onIncrease &&
          onDecrease
            ? stepper
            : null)}
      </div>
    )
  }

  return (
    <div
      className={`menu-item menu-item--pill${
        onClick ? " menu-item--tappable" : ""
      }`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? event => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault()
                onClick()
              }
            }
          : undefined
      }
    >
      <div className="menu-item-main">
        <div className="menu-item-image-wrap">
          <img
            className="menu-item-image"
            src={imageSrc}
            alt={name}
            onError={event => {
              const el = event.currentTarget
              if (el.dataset.fallbackApplied === "1") return
              el.dataset.fallbackApplied = "1"
              el.src = fallbackImage
            }}
          />
        </div>

        <div className="menu-item-copy">
          <h3 className="menu-item-name" title={name}>
            {name}
          </h3>
          {description && (
            <p className="menu-item-desc">{description}</p>
          )}
          <p className="menu-item-allergens">{allergenCopy}</p>
        </div>
      </div>

      <div className="menu-item-side">
        <div className="menu-item-price">£{price.toFixed(2)}</div>
        <div className="menu-item-controls">
          {children ?? stepper}
        </div>
      </div>
    </div>
  )
}
