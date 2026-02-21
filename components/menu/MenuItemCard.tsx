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
  editSummary?: string[]
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
  editSummary = [],
}: Props) {
  const imagePlaceholder = "/images/replace.png"
  const replacementLogo = "/images/fable-stores-logo.png"
  const normalizedImage = typeof image === "string" ? image.trim() : ""
  const imageSrc = normalizedImage.endsWith("/images/marlos-logo.png")
    ? replacementLogo
    : normalizedImage
  const isPlaceholderImage =
    imageSrc.length === 0 ||
    imageSrc.endsWith(imagePlaceholder) ||
    imageSrc.endsWith("/images/marlos-wordmark.png") ||
    imageSrc.endsWith("/images/marlos-wordmark-alpha.svg") ||
    imageSrc.endsWith("/images/marlos-wordmark-alpha-tight.png")
  const resolvedImageSrc = isPlaceholderImage ? imagePlaceholder : imageSrc
  const resolvedQuantity = typeof quantity === "number" ? quantity : 0

  const minusDisabled =
    controlsDisabled || !onDecrease || resolvedQuantity <= 0
  const plusDisabled = controlsDisabled || !onIncrease
  const resolvedEditDisabled =
    controlsDisabled || editDisabled || !onEdit
  const resolvedEditSummary = editSummary ?? []
  const hasEdits = resolvedEditSummary.length > 0
  const allergenCopy =
    allergens.length > 0
      ? `Allergen info: ${allergens.join(", ")}`
      : "Allergen info: none declared"

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
  const hasStepperControls =
    typeof quantity === "number" && Boolean(onIncrease && onDecrease)
  const resolvedControls =
    children ?? (hasStepperControls ? stepper : null)

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
        
        {hasEdits && resolvedEditSummary.length > 0 ? (
          <div className="menu-item-edits">
            {resolvedEditSummary.map((line, idx) => (
              <p key={idx} className="menu-item-edit-line">{line}</p>
            ))}
          </div>
        ) : (
          <p className="menu-item-allergens">{allergenCopy}</p>
        )}

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
          <div
            className={`menu-item-image-wrap${
              resolvedImageSrc ? "" : " menu-item-image-wrap--placeholder"
            }`}
            aria-hidden={!resolvedImageSrc}
          >
            <img
              className={`menu-item-image${
                isPlaceholderImage ? " menu-item-image--placeholder" : ""
              }`}
              src={resolvedImageSrc}
              alt={name}
              onError={event => {
                if (!event.currentTarget.src.includes(imagePlaceholder)) {
                  event.currentTarget.src = imagePlaceholder
                }
              }}
            />
          </div>

        <div className="menu-item-copy">
          <h3 className="menu-item-name" title={name}>
            {name}
          </h3>
        </div>
      </div>

      <div className="menu-item-side">
        <div className="menu-item-price">£{price.toFixed(2)}</div>
        {resolvedControls ? (
          <div className="menu-item-controls">{resolvedControls}</div>
        ) : null}
      </div>
      <p className="menu-item-allergens menu-item-allergens--full">
        {allergenCopy}
      </p>
    </div>
  )
}
