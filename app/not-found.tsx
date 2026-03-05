import Link from "next/link"
import { Card } from "@/components/ui/Card"
import { Divider } from "@/components/ui/Divider"

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 surface-primary">
      <Card className="w-full max-w-md space-y-4">
        <div className="text-lg font-semibold">
          Page not found
        </div>

        <div className="text-sm text-secondary">
          The page you are looking for does not exist or is no longer available.
        </div>

        <Divider />

        <div className="text-sm text-secondary">
          If you reached this page during service, return to a valid screen or contact staff.
        </div>

        <Link
          href="/menu"
          className="focus-ring inline-flex min-h-[44px] w-full items-center justify-center rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface-accent)] px-4 py-2 text-sm font-semibold"
        >
          Go back
        </Link>
      </Card>
    </div>
  )
}
