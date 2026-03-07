import { SkeletonCard } from "@/components/ui/Skeleton"

export default function GlobalLoading() {
  return (
    <div
      aria-busy="true"
      className="min-h-screen p-8 surface-primary page-fade"
    >
      <div className="mx-auto grid w-full max-w-3xl gap-5 md:grid-cols-2">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  )
}
