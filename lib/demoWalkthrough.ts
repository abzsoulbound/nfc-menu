export type DemoWalkthroughProfileId =
  | "FIRST_RUN"
  | "RUSH_HOUR"
  | "FULL_STORY"

export type DemoWalkthroughStep = {
  id: string
  title: string
  nextPath: string
  matchPrefix: string
  feed: string
  whyItMatters: string
}

export type DemoWalkthroughProfile = {
  id: DemoWalkthroughProfileId
  label: string
  summary: string
  steps: DemoWalkthroughStep[]
}

export const DEMO_WALKTHROUGH_STORAGE_KEY =
  "nfc_demo_walkthrough_v1"

export type DemoWalkthroughState = {
  enabled: boolean
  profileId: DemoWalkthroughProfileId
  stepIndex: number
  startedAtIso: string
}

export const DEMO_WALKTHROUGH_PROFILES: Record<
  DemoWalkthroughProfileId,
  DemoWalkthroughProfile
> = {
  FIRST_RUN: {
    id: "FIRST_RUN",
    label: "First Run Through",
    summary:
      "Calm customer journey walkthrough from menu entry to payment completion.",
    steps: [
      {
        id: "entry-menu",
        title: "Customer Entry",
        nextPath: "/menu",
        matchPrefix: "/menu",
        feed:
          "Guest lands instantly in the branded menu with no app install and no account creation.",
        whyItMatters:
          "Removes friction at the first touchpoint and increases start-rate.",
      },
      {
        id: "basket-build",
        title: "Build Basket",
        nextPath: "/order/takeaway",
        matchPrefix: "/order/",
        feed:
          "Guest configures items quickly with quantity and modifier control.",
        whyItMatters:
          "Keeps decision effort low and reduces ordering mistakes.",
      },
      {
        id: "review-safety",
        title: "Review Before Commit",
        nextPath: "/order/review/demo-tag",
        matchPrefix: "/order/review/",
        feed:
          "Guest sees a final review gate with clear totals and item confirmation.",
        whyItMatters:
          "Improves trust and catches errors before submission.",
      },
      {
        id: "support-path",
        title: "Guest Support Options",
        nextPath: "/guest-tools",
        matchPrefix: "/guest-tools",
        feed:
          "Guest can ask for help or use service tools without leaving flow.",
        whyItMatters:
          "Balances automation with human support to protect service quality.",
      },
      {
        id: "payment-close",
        title: "Checkout Close",
        nextPath: "/pay/1",
        matchPrefix: "/pay/",
        feed:
          "Guest completes payment with split and tip options shown clearly.",
        whyItMatters:
          "Closes the customer journey cleanly and reduces checkout abandonment.",
      },
    ],
  },
  RUSH_HOUR: {
    id: "RUSH_HOUR",
    label: "Rush Hour Operations",
    summary:
      "High-pressure service walkthrough showing queue control under peak load.",
    steps: [
      {
        id: "waiter-view",
        title: "Floor Control",
        nextPath: "/staff-login?next=/staff",
        matchPrefix: "/staff",
        feed:
          "Waiter dashboard shows active sessions and table state in real time.",
        whyItMatters:
          "Staff can prioritize quickly during service spikes.",
      },
      {
        id: "kitchen-queue",
        title: "Kitchen Queue",
        nextPath: "/staff-login?next=/kitchen",
        matchPrefix: "/kitchen",
        feed:
          "Kitchen queue updates live as new lines are submitted and prepared.",
        whyItMatters:
          "Demonstrates throughput visibility instead of manual ticket chaos.",
      },
      {
        id: "bar-queue",
        title: "Bar Queue",
        nextPath: "/staff-login?next=/bar",
        matchPrefix: "/bar",
        feed:
          "Bar station runs in parallel with independent queue progression.",
        whyItMatters:
          "Shows multi-station orchestration in one system.",
      },
      {
        id: "manager-controls",
        title: "Manager Controls",
        nextPath: "/staff-login?next=/manager/features",
        matchPrefix: "/manager/features",
        feed:
          "Manager can tune demand levers while service stays live.",
        whyItMatters:
          "Operational control and commercial control are connected.",
      },
      {
        id: "ops-close",
        title: "Revenue Close",
        nextPath: "/pay/1",
        matchPrefix: "/pay/",
        feed:
          "Flow ends at payment so operational work is tied directly to completed revenue.",
        whyItMatters:
          "Proves full-loop value, not isolated UI screens.",
      },
    ],
  },
  FULL_STORY: {
    id: "FULL_STORY",
    label: "Full Story",
    summary:
      "End-to-end narrative from guest entry, through operations, to commercial close.",
    steps: [
      {
        id: "full-menu",
        title: "Menu Entry",
        nextPath: "/menu",
        matchPrefix: "/menu",
        feed:
          "Guests start in a mobile-first menu with clear categories and pricing.",
        whyItMatters:
          "Fast orientation improves conversion into active orders.",
      },
      {
        id: "full-order",
        title: "Order Build",
        nextPath: "/order/takeaway",
        matchPrefix: "/order/",
        feed:
          "Guests create a real basket with edits and quantities.",
        whyItMatters:
          "Shows realistic behavior, not static demo content.",
      },
      {
        id: "full-review",
        title: "Review Safety",
        nextPath: "/order/review/demo-tag",
        matchPrefix: "/order/review/",
        feed:
          "Review step confirms items and lowers accidental submissions.",
        whyItMatters:
          "Error reduction is directly visible to buyers.",
      },
      {
        id: "full-staff",
        title: "Waiter Ops",
        nextPath: "/staff-login?next=/staff",
        matchPrefix: "/staff",
        feed:
          "Front-of-house sees table and session context instantly.",
        whyItMatters:
          "Service visibility improves response speed.",
      },
      {
        id: "full-kitchen",
        title: "Kitchen Ops",
        nextPath: "/staff-login?next=/kitchen",
        matchPrefix: "/kitchen",
        feed:
          "Kitchen queue reflects true prep state transitions.",
        whyItMatters:
          "Station workload becomes measurable and manageable.",
      },
      {
        id: "full-bar",
        title: "Bar Ops",
        nextPath: "/staff-login?next=/bar",
        matchPrefix: "/bar",
        feed:
          "Bar queue progresses independently while staying synchronized globally.",
        whyItMatters:
          "Parallel execution reduces bottlenecks.",
      },
      {
        id: "full-manager",
        title: "Manager Features",
        nextPath: "/staff-login?next=/manager/features",
        matchPrefix: "/manager/features",
        feed:
          "Managers can tune growth levers during live service.",
        whyItMatters:
          "Connects UX decisions to business outcomes.",
      },
      {
        id: "full-pay",
        title: "Payment Completion",
        nextPath: "/pay/1",
        matchPrefix: "/pay/",
        feed:
          "Guests complete payment cleanly with transparent totals.",
        whyItMatters:
          "Completes trust loop from discovery to paid receipt.",
      },
    ],
  },
}

export function getDemoWalkthroughProfile(
  profileId: DemoWalkthroughProfileId
) {
  return DEMO_WALKTHROUGH_PROFILES[profileId]
}

export function clampWalkthroughStepIndex(
  profileId: DemoWalkthroughProfileId,
  stepIndex: number
) {
  const profile = getDemoWalkthroughProfile(profileId)
  if (!Number.isFinite(stepIndex)) return 0
  const normalized = Math.floor(stepIndex)
  return Math.max(0, Math.min(profile.steps.length - 1, normalized))
}

export function detectWalkthroughStepIndexFromPathname(input: {
  profileId: DemoWalkthroughProfileId
  pathname: string
}) {
  const profile = getDemoWalkthroughProfile(input.profileId)
  const path = input.pathname.trim().toLowerCase()
  let bestMatchIndex: number | null = null
  let bestMatchLength = -1
  for (let index = 0; index < profile.steps.length; index += 1) {
    const step = profile.steps[index]
    const prefix = step.matchPrefix.toLowerCase()
    if (!path.startsWith(prefix)) continue
    if (prefix.length > bestMatchLength) {
      bestMatchLength = prefix.length
      bestMatchIndex = index
    }
  }
  return bestMatchIndex
}
