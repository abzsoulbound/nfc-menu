"use client"

export function Skeleton({
  className = "",
}: {
  className?: string
}) {
  return (
    <div
      aria-hidden="true"
      className={`shimmer-warm rounded-[var(--radius-control)] ${className}`}
    />
  )
}

export function SkeletonCard() {
  return (
    <div className="space-y-4 rounded-[var(--radius-card)] border border-[var(--border-subtle)] surface-elevated p-5">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-8 w-5/6" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  )
}

export function SkeletonMenu() {
  return (
    <div className="space-y-3 rounded-[var(--radius-card)] border border-[var(--border-subtle)] surface-elevated p-5">
      <Skeleton className="h-5 w-36" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-4/5" />
      <Skeleton className="h-24 w-full rounded-xl" />
    </div>
  )
}
