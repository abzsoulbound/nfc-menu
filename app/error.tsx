"use client"

import { useEffect } from "react"
import { Card } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Toast } from "@/components/ui/Toast"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Global runtime error:", error)
  }, [error])

  return (
    <div
      role="alert"
      className="ui-staff min-h-screen bg-[image:var(--shell-bg)] p-6 text-[var(--page-text)]"
    >
      <Card className="mx-auto w-full max-w-md space-y-4 section-hero">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--page-text-secondary)]">
          Runtime Recovery
        </div>

        <div className="text-lg font-semibold text-[var(--page-text)]">
          Something went wrong
        </div>

        <div className="text-sm text-[var(--page-text-secondary)]">
          An unexpected error occurred. Your session data
          has not been lost.
        </div>

        <Toast>
          The system encountered a temporary issue.
        </Toast>

        <div className="pt-2">
          <Button
            onClick={() => reset()}
            className="w-full !text-black"
          >
            Try again
          </Button>
        </div>
      </Card>
    </div>
  )
}
