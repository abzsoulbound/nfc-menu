import Link from "next/link"
import { Card } from "@/components/ui/Card"
import { Divider } from "@/components/ui/Divider"

export default function TableClosedPage({
  params,
}: {
  params: { tagId: string }
}) {
  const tagId = params.tagId

  return (
    <div className="px-4 py-6 md:px-6 md:py-8">
      <div className="mx-auto max-w-[760px] space-y-4">
        <Card variant="elevated">
          <div className="space-y-2">
            <h1 className="display-font text-4xl tracking-tight">
              Table Ordering Closed
            </h1>
            <p className="text-sm text-secondary">
              This table is no longer accepting new customer changes.
            </p>
          </div>
        </Card>

        <Card>
          <div className="space-y-2 text-sm text-secondary">
            <div>Your personal cart has not been deleted.</div>
            <div>
              You can still review your items, but no further changes can be made at this stage.
            </div>
            <Divider />
            <div>
              If you need anything beyond this point, please speak to a waiter.
            </div>
          </div>
        </Card>

        <Link
          href={`/order/${tagId}`}
          className="focus-ring inline-flex min-h-[52px] w-full items-center justify-center rounded-[var(--radius-control)] border border-transparent bg-[var(--accent-action)] px-4 py-2 text-sm font-semibold text-white transition-all duration-150 hover:bg-[var(--accent-action-strong)]"
        >
          Back to your items
        </Link>
      </div>
    </div>
  )
}

