import type { CustomerUxConfig } from "@/lib/types"

export type InformationFeedAction = {
  label: string
  nextPath: string
  tenantAware?: boolean
}

export type InformationFeedModel = {
  context: string
  title: string
  summary: string
  now: string
  next: string
  checks: string[]
  actions: InformationFeedAction[]
}

type InformationFeedInput = {
  pathname: string
  restaurantName: string
  ux: CustomerUxConfig
}

function normalizePath(pathname: string) {
  const noQuery = pathname.split("?")[0] ?? pathname
  return noQuery.replace(/\/+$/, "") || "/"
}

function menuDiscoveryLabel(value: CustomerUxConfig["menuDiscovery"]) {
  if (value === "HERO_FIRST") return "Hero-first discovery"
  if (value === "SECTION_FIRST") return "Section-first discovery"
  return "Search-first discovery"
}

function orderingLabel(value: CustomerUxConfig["ordering"]) {
  if (value === "BOTTOM_SHEET_FAST") return "Bottom-sheet ordering"
  if (value === "INLINE_STEPPER") return "Inline stepper ordering"
  return "Guided configurator ordering"
}

function reviewLabel(value: CustomerUxConfig["review"]) {
  if (value === "PAGE_REVIEW") return "Page review gate"
  return "Sheet review gate"
}

function checkoutLabel(value: CustomerUxConfig["checkout"]) {
  if (value === "GUIDED_SPLIT") return "Guided split checkout"
  if (value === "EXPRESS_FIRST") return "Express-first checkout"
  return "One-page checkout"
}

function engagementLabel(value: CustomerUxConfig["engagement"]) {
  if (value === "TASK_TABS") return "Task-tab engagement"
  if (value === "POST_PURCHASE_PROMPT") {
    return "Post-purchase prompt engagement"
  }
  return "All-in-one engagement"
}

function uxDigest(ux: CustomerUxConfig) {
  return [
    menuDiscoveryLabel(ux.menuDiscovery),
    orderingLabel(ux.ordering),
    reviewLabel(ux.review),
    checkoutLabel(ux.checkout),
  ].join(" | ")
}

export function resolveInformationFeed(
  input: InformationFeedInput
): InformationFeedModel {
  const path = normalizePath(input.pathname)
  const ux = input.ux
  const digest = uxDigest(ux)

  if (path === "/demo") {
    return {
      context: "Demo",
      title: "Guided Presentation Control",
      summary:
        "Use this page as the single control room. Start a feed mode, then walk pages in sequence while simulator runs.",
      now: "Select a scenario and start feed mode so users receive guided context on every page.",
      next: "Open customer menu first, then move into order, review, support, and payment.",
      checks: [
        "Simulator mode matches your demo story (First Run, Rush Hour, Full Peak).",
        "Guided feed overlay is visible on destination pages.",
        "Passcodes are ready before switching into staff routes.",
      ],
      actions: [
        { label: "Customer menu", nextPath: "/menu" },
        { label: "Staff login", nextPath: "/staff-login?next=/staff" },
        { label: "Manager features", nextPath: "/manager/features" },
      ],
    }
  }

  if (path === "/sales-demo") {
    return {
      context: "Sales",
      title: "Owner-Facing Sales Walkthrough",
      summary:
        "This page is structured for live calls. Lead with guest flow proof, then move to ops pressure and commercial close.",
      now: "Set simulator intensity to match buyer stage, then execute runbook in order.",
      next: "Transition from customer proof to station throughput, then close with payment and pricing.",
      checks: [
        "Queue movement is visible in kitchen/bar views.",
        "Manager controls are demonstrated before commercial close.",
        "Pricing handoff follows immediately after checkout proof.",
      ],
      actions: [
        { label: "Open menu", nextPath: "/menu" },
        { label: "Open kitchen", nextPath: "/kitchen" },
        { label: "Open pricing", nextPath: "/pricing", tenantAware: false },
      ],
    }
  }

  if (path === "/menu") {
    return {
      context: "Customer",
      title: `${input.restaurantName} Menu Experience`,
      summary:
        "Customer entry starts here. Information should be instantly understandable without scrolling or guesswork.",
      now: "Guide guests to an item quickly and confirm they understand price, allergens, and next step.",
      next: "Move into order flow with item selection and quantity edits.",
      checks: [
        digest,
        `Trust copy: ${ux.trustMicrocopy} | Social proof: ${ux.socialProofMode}`,
        "Primary CTA and support path are visible above the fold.",
      ],
      actions: [
        { label: "Order now", nextPath: "/order/takeaway" },
        { label: "Guest tools", nextPath: "/guest-tools" },
        { label: "Pay table", nextPath: "/pay/1" },
      ],
    }
  }

  if (path.startsWith("/order/review/") || path.endsWith("/review")) {
    return {
      context: "Customer",
      title: "Order Review Safety",
      summary:
        "This is the final confidence gate before submission. Show clarity and error prevention, not speed alone.",
      now: "Validate every line, quantity, edit, and allergen visibility before place-order action.",
      next: "Submit order, then direct user to support or payment path based on context.",
      checks: [
        `${reviewLabel(ux.review)} | Order safety: ${ux.orderSafetyMode}`,
        "Totals and irreversible-action language are explicit.",
        "Back/edit route is obvious and one-tap.",
      ],
      actions: [
        { label: "Back to order", nextPath: "/order/takeaway" },
        { label: "Guest tools", nextPath: "/guest-tools" },
        { label: "Checkout", nextPath: "/pay/1" },
      ],
    }
  }

  if (path.startsWith("/order/")) {
    return {
      context: "Customer",
      title: "Order Build Flow",
      summary:
        "Configuration and quantity changes happen here. Keep the cognitive load low and corrections easy.",
      now: "Confirm item configuration and quantity with minimal friction and clear cost impact.",
      next: "Advance to review gate before final submission.",
      checks: [
        `${orderingLabel(ux.ordering)} | Progress anchors: ${ux.showProgressAnchors ? "On" : "Off"}`,
        "Required selections are explicit before continue.",
        "Correction path is visible without losing progress.",
      ],
      actions: [
        { label: "Review order", nextPath: "/order/review/demo-tag" },
        { label: "Menu", nextPath: "/menu" },
        { label: "Checkout", nextPath: "/pay/1" },
      ],
    }
  }

  if (path.startsWith("/pay/")) {
    return {
      context: "Customer",
      title: "Checkout Completion",
      summary:
        "Payment should be transparent and decisive. User should never guess final totals or what happens next.",
      now: "Confirm split/tip choices and keep total visibility fixed until payment completion.",
      next: "Complete payment and provide clear receipt/confirmation outcome.",
      checks: [
        `${checkoutLabel(ux.checkout)} | Checkout safety: ${ux.checkoutSafetyMode}`,
        `Tip strategy: ${ux.tipPresetStrategy} | Default tip: ${ux.defaultTipPercent}%`,
        "Error guidance is specific when a field is invalid.",
      ],
      actions: [
        { label: "Guest tools", nextPath: "/guest-tools" },
        { label: "Menu", nextPath: "/menu" },
        { label: "Manager view", nextPath: "/manager" },
      ],
    }
  }

  if (path.startsWith("/guest-tools")) {
    return {
      context: "Customer",
      title: "Guest Support + Engagement",
      summary:
        "This route keeps self-service from feeling isolating by exposing clear support and follow-up actions.",
      now: "Show the fastest support action first and keep status language explicit.",
      next: "Route user back to ordering or payment without losing context.",
      checks: [
        `${engagementLabel(ux.engagement)} | Trust copy: ${ux.trustMicrocopy}`,
        "Need-staff-help path is visible and unambiguous.",
        "Post-action expectation is explicit (response time or next screen).",
      ],
      actions: [
        { label: "Order flow", nextPath: "/order/takeaway" },
        { label: "Pay table", nextPath: "/pay/1" },
        { label: "Menu", nextPath: "/menu" },
      ],
    }
  }

  if (path.startsWith("/staff-login")) {
    return {
      context: "Staff",
      title: "Role-Gated Access",
      summary:
        "This step controls operational safety. Role selection and outcome should be immediate and obvious.",
      now: "Authenticate with correct role passcode and confirm destination route before proceeding.",
      next: "Move directly into floor, kitchen, bar, manager, or admin workspace.",
      checks: [
        "Role expectations match route permissions.",
        "Login failure language is clear and actionable.",
        "Post-login redirect route is correct.",
      ],
      actions: [
        { label: "Waiter workspace", nextPath: "/staff" },
        { label: "Kitchen workspace", nextPath: "/kitchen" },
        { label: "Manager workspace", nextPath: "/manager" },
      ],
    }
  }

  if (path.startsWith("/staff")) {
    return {
      context: "Staff",
      title: "Waiter Operations",
      summary:
        "Floor team should see table state and next action instantly. No hidden state transitions.",
      now: "Prioritize active tables, stale sessions, and pending deliveries from one view.",
      next: "Escalate to kitchen/bar queues or manager controls if bottlenecks emerge.",
      checks: [
        "Table status transitions are visible and reversible where safe.",
        "Session context is current before actioning an order.",
        "Escalation path to manager remains one click away.",
      ],
      actions: [
        { label: "Kitchen queue", nextPath: "/kitchen" },
        { label: "Bar queue", nextPath: "/bar" },
        { label: "Manager", nextPath: "/manager" },
      ],
    }
  }

  if (path.startsWith("/kitchen")) {
    return {
      context: "Kitchen",
      title: "Kitchen Queue Control",
      summary:
        "Queue order and state changes must be explicit to reduce missed or duplicated prep.",
      now: "Move lines through submitted -> prepping -> ready with clear confirmation.",
      next: "Coordinate handoff with waiter delivery flow and monitor delayed lines.",
      checks: [
        "Oldest pending lines are visible without extra filtering.",
        "Prep/ready transitions update immediately.",
        "Cross-station dependency status is clear.",
      ],
      actions: [
        { label: "Waiter dashboard", nextPath: "/staff" },
        { label: "Bar queue", nextPath: "/bar" },
        { label: "Manager", nextPath: "/manager" },
      ],
    }
  }

  if (path.startsWith("/bar")) {
    return {
      context: "Bar",
      title: "Bar Queue Control",
      summary:
        "Bar flow should stay synchronized with table and waiter state while preserving station autonomy.",
      now: "Advance drink lines quickly and keep status transitions explicit.",
      next: "Coordinate with waiter delivery and manager oversight during spikes.",
      checks: [
        "Queue priority is obvious during peak load.",
        "Ready-state updates are visible to floor staff immediately.",
        "Delay hotspots are surfaced early.",
      ],
      actions: [
        { label: "Waiter dashboard", nextPath: "/staff" },
        { label: "Kitchen queue", nextPath: "/kitchen" },
        { label: "Manager", nextPath: "/manager" },
      ],
    }
  }

  if (path.startsWith("/manager/customize")) {
    return {
      context: "Manager",
      title: "Experience Customization",
      summary:
        "This is where clarity policy is configured. Keep customer guidance consistent across menu, order, and payment.",
      now: "Adjust copy, trust cues, and safety modes with immediate intent for the next service period.",
      next: "Validate changes in live customer routes and then review manager features.",
      checks: [
        `Preset: ${ux.presetId} | Order safety: ${ux.orderSafetyMode} | Checkout safety: ${ux.checkoutSafetyMode}`,
        "Social proof is verified-only and never fabricated.",
        "CTA copy remains specific and action-oriented.",
      ],
      actions: [
        { label: "Manager features", nextPath: "/manager/features" },
        { label: "Customer menu", nextPath: "/menu" },
        { label: "Manager home", nextPath: "/manager" },
      ],
    }
  }

  if (path.startsWith("/manager/features")) {
    return {
      context: "Manager",
      title: "Growth + Experiments",
      summary:
        "Feature and experiment controls should tie directly to trust, error rate, and checkout completion outcomes.",
      now: "Review active experiments and ensure assignment, events, and insights are interpretable.",
      next: "Apply safe variants, monitor guardrails, then verify customer-facing behavior.",
      checks: [
        "Primary metric and guardrail metrics are both visible.",
        "Experiment changes are tenant-scoped and role-protected.",
        "Insights indicate actionable next decision.",
      ],
      actions: [
        { label: "Manager customize", nextPath: "/manager/customize" },
        { label: "Customer menu", nextPath: "/menu" },
        { label: "Manager home", nextPath: "/manager" },
      ],
    }
  }

  if (path.startsWith("/manager")) {
    return {
      context: "Manager",
      title: "Operations Management",
      summary:
        "This view should make operational decisions obvious with minimal ambiguity.",
      now: "Track service status, bottlenecks, and readiness before touching configuration.",
      next: "Branch to customize/features for strategic changes, then validate in live routes.",
      checks: [
        "Current service posture is clear (locked/open/stale).",
        "High-risk actions are explicit and deliberate.",
        "Escalation to admin remains straightforward.",
      ],
      actions: [
        { label: "Customize", nextPath: "/manager/customize" },
        { label: "Features", nextPath: "/manager/features" },
        { label: "Admin", nextPath: "/admin" },
      ],
    }
  }

  if (path.startsWith("/admin")) {
    return {
      context: "Admin",
      title: "System Governance",
      summary:
        "Admin surfaces should prioritize correctness, policy, and risk containment over speed.",
      now: "Verify system state before running privileged actions.",
      next: "Return to manager/staff views to validate downstream impact.",
      checks: [
        "Environment and policy constraints are satisfied.",
        "High-impact actions are reversible or explicitly irreversible.",
        "Auditability remains intact after changes.",
      ],
      actions: [
        { label: "Manager", nextPath: "/manager" },
        { label: "Staff", nextPath: "/staff" },
        { label: "Demo hub", nextPath: "/demo" },
      ],
    }
  }

  if (path === "/" || path.startsWith("/company")) {
    return {
      context: "Public",
      title: "Platform Overview",
      summary:
        "State the value clearly: faster guest ordering, clearer operations, and reliable payment completion.",
      now: "Route visitors to concrete proof pages, not generic claims.",
      next: "Move to simulator or pricing with minimal friction.",
      checks: [
        "Value proposition is specific and outcome-led.",
        "Proof path is obvious in the first screenful.",
        "Contact route is one action away.",
      ],
      actions: [
        { label: "Open simulator", nextPath: "/demo", tenantAware: false },
        { label: "Pricing", nextPath: "/pricing", tenantAware: false },
        { label: "Contact", nextPath: "/contact", tenantAware: false },
      ],
    }
  }

  return {
    context: "Info",
    title: "Page Guidance",
    summary:
      "This page follows the same clarity policy: immediate intent, explicit next step, and visible safety checks.",
    now: "Complete the primary task shown on screen before navigating away.",
    next: "Use quick actions to move to the most likely follow-up route.",
    checks: [
      "Action label is specific to user intent.",
      "Outcome is visible immediately after action.",
      "Fallback/help path is available.",
    ],
    actions: [
      { label: "Menu", nextPath: "/menu" },
      { label: "Staff", nextPath: "/staff" },
      { label: "Manager", nextPath: "/manager" },
    ],
  }
}
