"use client"

import Link from "next/link"
import { useParams, usePathname } from "next/navigation"
import { Card } from "@/components/ui/Card"
import { Divider } from "@/components/ui/Divider"
import { Button } from "@/components/ui/Button"
import { tenantTagPath } from "@/lib/tenantPaths"

export default function TableClosedPage() {
  const pathname = usePathname()
  const params = useParams<{ tagId?: string }>()
  const tagId =
    typeof params?.tagId === "string"
      ? params.tagId.trim()
      : ""

  return (
    <div className="p-4 space-y-4">
      <Card>
        <div className="text-lg font-semibold">
          Table ordering closed
        </div>
        <div className="text-sm opacity-70">
          This table is no longer accepting customer edits
          or new contributions.
        </div>
      </Card>

      <Divider />

      <Card>
        <div className="space-y-2 text-sm">
          <div>
            Your personal cart has not been deleted.
          </div>
          <div className="opacity-70">
            You can still review your items, but no
            changes can be made at this stage.
          </div>
        </div>
      </Card>

      <Divider />

      <Card>
        <div className="text-sm opacity-70">
          If you would like to make any changes beyond
          this point, please refer to a waiter for help.
        </div>
      </Card>

      <Divider />

      <Link href={tenantTagPath(pathname, tagId)}>
        <Button className="w-full" variant="secondary">
          Back to your items
        </Button>
      </Link>
    </div>
  )
}
