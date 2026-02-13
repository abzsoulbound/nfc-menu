import Link from "next/link"
import { Card } from "@/components/ui/Card"
import { Divider } from "@/components/ui/Divider"
import { Button } from "@/components/ui/Button"

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 surface-primary">
      <Card className="w-full max-w-md space-y-4">
        <div className="text-lg font-semibold">
          Page not found
        </div>

        <div className="text-sm text-secondary">
          The page you’re looking for doesn’t exist or
          is no longer available.
        </div>

        <Divider />

        <div className="text-sm text-secondary">
          If you reached this page during service, please
          return to a valid screen or contact staff.
        </div>

        <Link href="/order/menu">
          <Button className="w-full" variant="secondary">
            Go back
          </Button>
        </Link>
      </Card>
    </div>
  )
}
