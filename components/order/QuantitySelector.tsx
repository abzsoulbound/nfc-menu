import { Button } from "@/components/ui/Button"

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
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="secondary"
        disabled={value <= min}
        onClick={() => onChange(value - 1)}
      >
        −
      </Button>

      <div className="min-w-[2rem] text-center">
        {value}
      </div>

      <Button
        variant="secondary"
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
      >
        +
      </Button>
    </div>
  )
}