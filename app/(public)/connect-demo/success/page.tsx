import Link from "next/link"
import { notFound } from "next/navigation"
import { Card } from "@/components/ui/Card"
import { isDemoToolsEnabled } from "@/lib/env"

type ConnectDemoSuccessPageProps = {
  searchParams: {
    session_id?: string
  }
}

export default function ConnectDemoSuccessPage({
  searchParams,
}: ConnectDemoSuccessPageProps) {
  if (!isDemoToolsEnabled()) {
    notFound()
  }

  const sessionId = searchParams.session_id?.trim() ?? ""

  return (
    <div className="px-4 py-5 md:px-6 md:py-6">
      <div className="mx-auto max-w-[820px] space-y-4">
        <Card variant="elevated" className="space-y-3">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
            Sample Checkout Complete
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Hosted Checkout returned successfully
          </h1>
          <p className="text-sm leading-6 text-secondary">
            Stripe sent the buyer back to your sample storefront. For a real
            integration, confirm fulfillment using webhooks and the Checkout
            Session or PaymentIntent rather than trusting this redirect alone.
          </p>
          <div className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface-accent)] p-3 text-sm">
            Session ID:{" "}
            <span className="mono-font">
              {sessionId || "Stripe will append ?session_id=... after payment."}
            </span>
          </div>
          <Link
            href="/connect-demo"
            className="focus-ring inline-flex min-h-[44px] items-center justify-center rounded-[var(--radius-control)] border border-[var(--border)] px-4 py-2 text-sm font-semibold"
          >
            Back to Connect demo
          </Link>
        </Card>
      </div>
    </div>
  )
}
