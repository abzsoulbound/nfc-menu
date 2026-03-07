import { DemoSetupPageClient } from "@/components/demo/DemoSetupPageClient"

export const metadata = {
  title: "Demo Setup",
  robots: {
    index: false,
    follow: false,
  },
}

export default function DemoSetupPage() {
  return <DemoSetupPageClient />
}
