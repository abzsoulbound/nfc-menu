"use client"

import { ReactNode } from "react"
import { Button } from "@/components/ui/Button"

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
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-[rgba(7,14,26,0.45)] backdrop-blur-[1px]">
      <button
        aria-label="Close sheet"
        className="absolute inset-0 h-full w-full cursor-default"
        onClick={onClose}
        type="button"
      />
      <div className="relative w-full rounded-t-[24px] border border-[var(--border)] surface-elevated p-4 shadow-[var(--shadow-hard)] md:mx-auto md:mb-6 md:max-w-2xl md:rounded-[var(--radius-card)]">
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
