export function getTenantPrefixFromPath(pathname: string | null | undefined) {
  if (!pathname) return "/order"
  return "/order"
}

export function tenantTagPath(
  pathname: string | null | undefined,
  tagId: string,
  suffix = ""
) {
  const prefix = getTenantPrefixFromPath(pathname)
  const cleanSuffix = suffix
    ? suffix.startsWith("/")
      ? suffix
      : `/${suffix}`
    : ""
  return `${prefix}/t/${encodeURIComponent(tagId)}${cleanSuffix}`
}
