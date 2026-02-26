import { OperationsControlCenter } from "@/components/ops/OperationsControlCenter"
import { Card } from "@/components/ui/Card"

export default function ManagerPage() {
  return (
    <div className="px-4 py-5 md:px-6 md:py-6">
      <div className="mx-auto max-w-[1440px] space-y-4">
        <Card variant="elevated">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight">
              Manager Console
            </h1>
            <p className="text-sm text-secondary">
              Live operational controls for service state, tables, queues, and interventions.
            </p>
          </div>
        </Card>

        <OperationsControlCenter role="manager" />
      </div>
    </div>
  )
}

