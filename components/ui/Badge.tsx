export function Badge({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <span className="px-2 py-0.5 text-xs rounded surface-accent text-primary">
      {children}
    </span>
  )
}