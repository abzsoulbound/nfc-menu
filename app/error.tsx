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
    <div className="min-h-screen flex items-center justify-center p-6">
      <Card className="max-w-md w-full space-y-4">
        <div className="text-lg font-semibold">
          Something went wrong
        </div>

        <div className="text-sm opacity-70">
          An unexpected error occurred. Your session data
          has not been lost.
        </div>

        <Toast>
          The system encountered a temporary issue.
        </Toast>

        <div className="pt-2">
          <Button
            onClick={() => reset()}
            className="w-full"
          >
            Try again
          </Button>
        </div>
      </Card>
    </div>
  )
}
