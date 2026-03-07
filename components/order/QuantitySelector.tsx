"use client"

import { useCallback, useRef } from "react"
import { Button } from "@/components/ui/Button"
import { haptic } from "@/lib/haptics"

export function QuantitySelector({
  value,
  min = 0,
  max = 20,
  onChange,
}: {
  value: number
  min?: number
  max?: number
  onChange: (value: number) => void
}) {
  const displayRef = useRef<HTMLDivElement>(null)

  const animateValue = useCallback(() => {
    const el = displayRef.current
    if (!el) return
    el.classList.remove("count-up")
    void el.offsetWidth
    el.classList.add("count-up")
  }, [])

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="secondary"
        disabled={value <= min}
        onClick={() => {
          onChange(value - 1)
          animateValue()
          haptic("light")
        }}
        className="min-h-[44px] min-w-[44px] px-0"
      >
        -
      </Button>

      <div ref={displayRef} className="min-w-[2.2rem] text-center font-semibold">
        {value}
      </div>

      <Button
        variant="secondary"
        disabled={value >= max}
        onClick={() => {
          onChange(value + 1)
          animateValue()
          haptic("medium")
        }}
        className="min-h-[44px] min-w-[44px] px-0"
      >
        +
      </Button>
    </div>
  )
}
