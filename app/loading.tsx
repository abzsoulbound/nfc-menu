import { SkeletonCard } from "@/components/ui/Skeleton"

export default function GlobalLoading() {
  return (
    <div
      aria-busy="true"
      className="ui-staff min-h-screen bg-[image:var(--shell-bg)] p-8 text-[var(--page-text)] page-fade"
    >
      <div className="mx-auto mb-5 max-w-3xl">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--page-text-secondary)]">
          Loading
        </div>
      </div>
      <div className="mx-auto grid w-full max-w-3xl gap-5 md:grid-cols-2">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  )
}
