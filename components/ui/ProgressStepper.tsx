"use client"

export function ProgressStepper({
  steps,
  currentStep,
}: {
  steps: string[]
  currentStep: number
}) {
  const safeCurrentStep = Math.max(
    1,
    Math.min(currentStep, steps.length)
  )

  return (
    <ol
      className="grid gap-2 md:grid-cols-3"
      aria-label="Checkout progress"
    >
      {steps.map((label, index) => {
        const stepNumber = index + 1
        const completed = stepNumber < safeCurrentStep
        const current = stepNumber === safeCurrentStep

        return (
          <li
            key={label}
            aria-current={current ? "step" : undefined}
            className="relative rounded-[var(--radius-control)] border border-[var(--border)] bg-[rgba(255,255,255,0.6)] px-3 py-2"
          >
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                  completed || current
                    ? "bg-[var(--accent-action)] text-black"
                    : "bg-[var(--surface-accent)] text-secondary"
                }`}
              >
                {stepNumber}
              </span>
              <span
                className={`text-xs font-semibold uppercase tracking-[0.08em] ${
                  completed || current
                    ? "text-[var(--text-primary)]"
                    : "text-muted"
                }`}
              >
                {label}
              </span>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
