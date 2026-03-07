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

export function ModalProvider({
  children,
}: {
  children: ReactNode
}) {
  return <>{children}</>
}

export function Modal({
  title,
  children,
  onConfirm,
  onCancel,
  confirmDisabled,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
}: {
  title: string
  children: ReactNode
  onConfirm: () => void
  onCancel: () => void
  confirmDisabled?: boolean
  confirmLabel?: string
  cancelLabel?: string
}) {
  const modalRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const activeBeforeOpen =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    const node = modalRef.current
    if (!node) {
      return
    }
    const container = node

    const initialFocus = focusableElements(container)[0] ?? container
    initialFocus.focus()

    function handleKeydown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault()
        onCancel()
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
  }, [onCancel])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(8,14,26,0.58)] p-4 backdrop-blur-sm">
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="w-full max-w-md rounded-[var(--radius-card)] border border-[var(--border)] surface-elevated p-4 shadow-[var(--shadow-hard)]"
      >
        <div className="space-y-3">
          <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
          <div className="text-sm text-secondary">{children}</div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="quiet" onClick={onCancel}>
              {cancelLabel}
            </Button>
            <Button
              variant="primary"
              onClick={onConfirm}
              disabled={confirmDisabled}
            >
              {confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
