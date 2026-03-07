import { notFound } from "next/navigation"
import { StripeConnectSampleClient } from "@/components/stripe-sample/StripeConnectSampleClient"
import { isDemoToolsEnabled } from "@/lib/env"

export default function ConnectDemoPage() {
  if (!isDemoToolsEnabled()) {
    notFound()
  }
  return <StripeConnectSampleClient />
}
