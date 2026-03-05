import { useId } from "react"
import { Jost } from "next/font/google"

type SoulboundStudioLogoProps = {
  className?: string
  compact?: boolean
  tone?: "default" | "light"
}

const logoWordmarkFont = Jost({
  subsets: ["latin"],
  weight: ["200", "300", "400"],
})

function SoulboundStudioGlyph({
  className,
}: {
  className: string
}) {
  const rawId = useId()
  const token = rawId.replace(/[^a-zA-Z0-9_-]/g, "")
  const gradientId = `sb-gold-${token}`
  const glowId = `sb-glow-${token}`

  return (
    <svg
      viewBox="0 0 96 96"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f0d898" />
          <stop offset="55%" stopColor="#c9a96e" />
          <stop offset="100%" stopColor="#9a7030" />
        </linearGradient>
        <filter id={glowId} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="2.5" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <rect
        x="14"
        y="14"
        width="68"
        height="68"
        rx="4"
        fill="#0c1020"
        stroke={`url(#${gradientId})`}
        strokeWidth="2.2"
        transform="rotate(45 48 48)"
      />
      <rect
        x="22"
        y="22"
        width="52"
        height="52"
        rx="2"
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth="0.7"
        opacity="0.2"
        transform="rotate(45 48 48)"
      />
      <polyline
        points="26,58 48,30 70,58"
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth="4"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
      <polyline
        points="32,68 48,50 64,68"
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth="2"
        strokeLinecap="square"
        strokeLinejoin="miter"
        opacity="0.45"
      />
      <circle cx="48" cy="30" r="3.2" fill="#c9a96e" filter={`url(#${glowId})`} />
    </svg>
  )
}

export function SoulboundStudioLogo({
  className = "",
  compact = false,
  tone = "default",
}: SoulboundStudioLogoProps) {
  const nameToneClass = tone === "light"
    ? "text-[#e7ddcc]"
    : "text-[var(--text-primary)]"

  if (compact) {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <SoulboundStudioGlyph className="h-12 w-12 shrink-0" />
        <div className={`${logoWordmarkFont.className} leading-tight`}>
          <div
            className={`pr-[0.26em] text-[10px] font-light uppercase tracking-[0.26em] sm:text-[11px] ${nameToneClass}`}
          >
            Soulbound
          </div>
          <div
            className={`pr-[0.26em] text-[10px] font-light uppercase tracking-[0.26em] sm:text-[11px] ${nameToneClass}`}
          >
            Studio
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`flex flex-col items-center gap-6 ${className}`}>
      <SoulboundStudioGlyph className="h-24 w-24 md:h-28 md:w-28" />

      <div className={logoWordmarkFont.className}>
        <span className={`pr-[0.44em] text-[15px] font-light uppercase tracking-[0.44em] md:text-[16.5px] ${nameToneClass}`}>
          Soulbound Studio
        </span>
      </div>
    </div>
  )
}
