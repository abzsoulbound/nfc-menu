"use client"

import { useEffect, useRef } from "react"
import { haptic } from "@/lib/haptics"
import { useFeature } from "@/store/useFeatureStore"

export function PaymentCelebration({
  receiptId,
  totalCharged,
  tipAmount,
  method,
  remainingDue,
  onDismiss,
}: {
  receiptId: string
  totalCharged: number
  tipAmount: number
  method: string
  remainingDue: number
  onDismiss?: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const tippingEnabled = useFeature("tipping")

  useEffect(() => {
    haptic("success")
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = canvas.offsetWidth * dpr
    canvas.height = canvas.offsetHeight * dpr
    ctx.scale(dpr, dpr)

    const particles: {
      x: number
      y: number
      vx: number
      vy: number
      size: number
      color: string
      alpha: number
      decay: number
    }[] = []

    const colors = ["#d9ae3f", "#f2d27a", "#001258", "#f0d060", "#faf6ef", "#002080"]
    const w = canvas.offsetWidth
    const h = canvas.offsetHeight

    for (let i = 0; i < 80; i++) {
      particles.push({
        x: w / 2 + (Math.random() - 0.5) * w * 0.4,
        y: h * 0.35,
        vx: (Math.random() - 0.5) * 7,
        vy: -Math.random() * 6 - 2,
        size: Math.random() * 5 + 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 1,
        decay: 0.008 + Math.random() * 0.01,
      })
    }

    let animFrame: number

    function animate() {
      if (!ctx || !canvas) return
      const w = canvas.offsetWidth
      const h = canvas.offsetHeight
      ctx.clearRect(0, 0, w, h)

      let alive = false
      for (const p of particles) {
        if (p.alpha <= 0) continue
        alive = true
        p.x += p.vx
        p.y += p.vy
        p.vy += 0.12
        p.vx *= 0.99
        p.alpha -= p.decay

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fillStyle = p.color
        ctx.globalAlpha = Math.max(0, p.alpha)
        ctx.fill()
      }
      ctx.globalAlpha = 1

      if (alive) {
        animFrame = requestAnimationFrame(animate)
      }
    }

    animFrame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animFrame)
  }, [])

  function money(v: number) {
    return `£${v.toFixed(2)}`
  }

  return (
    <div className="celebrate-in warm-wash relative overflow-hidden rounded-[var(--radius-card)] border border-[var(--accent-metal)] bg-[linear-gradient(165deg,rgba(250,246,239,0.98),rgba(217,174,63,0.12))] px-6 py-10 text-center shadow-[var(--shadow-elevated)] md:px-10 md:py-14">
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 h-full w-full"
        aria-hidden="true"
      />

      <div className="relative space-y-7">
        {/* Gold checkmark */}
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[var(--accent-metal)] shadow-[0_0_40px_rgba(217,174,63,0.4)]">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        <div className="space-y-2">
          <h2 className="display-font text-4xl tracking-tight text-[var(--text-heading)] md:text-5xl">
            Thank you
          </h2>
          <p className="text-base text-secondary">
            Your payment has been confirmed
          </p>
        </div>

        {/* Receipt-style breakdown */}
        <div className="receipt-surface mx-auto max-w-xs space-y-3 rounded-xl px-6 py-5 text-left">
          <div className="flex justify-between text-base">
            <span className="text-secondary">Amount charged</span>
            <span className="font-semibold tabular-nums">{money(totalCharged)}</span>
          </div>
          {tippingEnabled && (
            <div className="flex justify-between text-base">
              <span className="text-secondary">Tip included</span>
              <span className="font-semibold accent-metal tabular-nums">{money(tipAmount)}</span>
            </div>
          )}
          <div className="flex justify-between text-base">
            <span className="text-secondary">Method</span>
            <span className="font-semibold">{method.replace("_", " ")}</span>
          </div>
          <div className="h-px bg-[var(--border-subtle)]" />
          <div className="flex justify-between text-base">
            <span className="text-secondary">Remaining due</span>
            <span className="font-semibold tabular-nums">{money(remainingDue)}</span>
          </div>
          <div className="pt-2 text-center text-xs text-muted">
            Receipt {receiptId.slice(0, 8)}
          </div>
        </div>

        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="focus-ring action-surface action-button px-6"
          >
            Back to menu
          </button>
        )}
      </div>
    </div>
  )
}
