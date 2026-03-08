import Link from "next/link"
import { Card } from "@/components/ui/Card"
import { Divider } from "@/components/ui/Divider"

export default function NotFound() {
  return (
    <div className="ui-staff min-h-screen bg-[image:var(--shell-bg)] p-6 text-[var(--page-text)]">
      <Card className="mx-auto w-full max-w-md space-y-4 section-hero">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--page-text-secondary)]">
          Route Missing
        </div>

        <div className="text-lg font-semibold text-[var(--page-text)]">
          Page not found
        </div>

        <div className="text-sm text-[var(--page-text-secondary)]">
          The page you are looking for does not exist or is no longer available.
        </div>

        <Divider />

        <div className="text-sm text-[var(--page-text-secondary)]">
          If you reached this page during service, return to a valid screen or contact staff.
        </div>

        <Link
          href="/menu"
          className="focus-ring action-surface action-button w-full"
        >
          Back to menu
        </Link>
      </Card>
    </div>
  )
}
