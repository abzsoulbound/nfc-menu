"use client"

import { ReactNode, useEffect, useRef } from "react"
import { Button } from "@/components/ui/Button"

function focusableElements(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  ).filter(el => {
    const ariaHidden = el.getAttribute("aria-hidden")
    return !el.hasAttribute("disabled") && ariaHidden !== "true"
  })
}

export function BottomSheet({
  title,
  children,
  onClose,
  primaryAction,
}: {
  title: string
  children: ReactNode
  onClose: () => void
  primaryAction?: {
    label: string
    onClick: () => void
    disabled?: boolean
  }
}) {
  const sheetRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const activeBeforeOpen =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    const node = sheetRef.current
    if (!node) {
      return
    }
    const container = node

    const initialFocus = focusableElements(container)[0] ?? container
    initialFocus.focus()

    function handleKeydown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault()
        onClose()
        return
      }

      if (event.key !== "Tab") {
        return
      }

      const candidates = focusableElements(container)
      if (candidates.length === 0) {
        event.preventDefault()
        container.focus()
        return
      }

      const first = candidates[0]
      const last = candidates[candidates.length - 1]
      const current = document.activeElement

      if (event.shiftKey) {
        if (current === first || !container.contains(current)) {
          event.preventDefault()
          last.focus()
        }
        return
      }

      if (current === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener("keydown", handleKeydown)

    return () => {
      document.removeEventListener("keydown", handleKeydown)
      activeBeforeOpen?.focus()
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-[rgba(7,14,26,0.45)] backdrop-blur-[1px]">
      <button
        aria-label="Close sheet"
        className="absolute inset-0 h-full w-full cursor-default"
        onClick={onClose}
        type="button"
      />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="relative w-full rounded-t-[24px] border border-[var(--border-subtle)] glass-surface p-5 shadow-[var(--shadow-elevated)] md:mx-auto md:mb-6 md:max-w-2xl md:rounded-[var(--radius-card)]"
      >
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-[var(--border)] md:hidden" />
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
          <Button variant="ghost" onClick={onClose} className="min-h-[36px] px-3">
            Close
          </Button>
        </div>
        <div className="max-h-[65vh] overflow-y-auto pb-2">{children}</div>
        {primaryAction && (
          <div className="mt-4">
            <Button
              className="w-full"
              variant="primary"
              onClick={primaryAction.onClick}
              disabled={primaryAction.disabled}
            >
              {primaryAction.label}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
