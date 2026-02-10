import { Card } from "@/components/ui/Card"

export default function GlobalLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 surface-primary">
      <Card className="w-full max-w-sm text-center">
        <div className="text-sm text-secondary">
          Loading…
        </div>
      </Card>
    </div>
  )
}
