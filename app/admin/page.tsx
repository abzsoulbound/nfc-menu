import { AdminSystemControls } from "@/components/admin/AdminSystemControls"
import { MenuControls } from "@/components/admin/MenuControls"
import { OperationsControlCenter } from "@/components/ops/OperationsControlCenter"
import { Card } from "@/components/ui/Card"

function masked(value: string | undefined) {
  if (!value) return "not set"
  if (value.length <= 2) return "*".repeat(value.length)
  return `${value.slice(0, 1)}***${value.slice(-1)}`
}

export default function AdminPage() {
  const environmentSummary = [
    {
      label: "Waiter passcodes",
      value: masked(process.env.WAITER_PASSCODES),
    },
    {
      label: "Kitchen passcodes",
      value: masked(process.env.KITCHEN_PASSCODES),
    },
    {
      label: "Bar passcodes",
      value: masked(process.env.BAR_PASSCODES),
    },
    {
      label: "Manager passcodes",
      value: masked(process.env.MANAGER_PASSCODES),
    },
    {
      label: "Admin passcodes",
      value: masked(process.env.ADMIN_PASSCODES),
    },
    {
      label: "System auth secret",
      value: masked(process.env.SYSTEM_AUTH_SECRET),
    },
  ]

  return (
    <div className="px-4 py-5 md:px-6 md:py-6">
      <div className="mx-auto max-w-[1440px] space-y-4">
        <Card variant="elevated">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight">
              Admin Control
            </h1>
            <p className="text-sm text-secondary">
              Developer-facing controls for menu management, emergency recovery, and system visibility.
            </p>
          </div>
        </Card>

        <OperationsControlCenter role="admin" />
        <MenuControls />
        <AdminSystemControls />

        <Card>
          <div className="space-y-2">
            <div className="text-sm font-semibold uppercase tracking-[0.14em] text-muted">
              Passcode environment status
            </div>
            <div className="space-y-1 text-sm">
              {environmentSummary.map(item => (
                <div
                  key={item.label}
                  className="flex items-center justify-between gap-2 rounded-[var(--radius-control)] border border-[var(--border)] surface-accent px-3 py-2"
                >
                  <span>{item.label}</span>
                  <span className="mono-font text-xs">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
