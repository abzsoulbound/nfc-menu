function decodeSafe(value: string) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export function getTenantPrefixFromPath(pathname: string | null | undefined) {
  if (!pathname) return ""
  const tenantMatch = pathname.match(/^\/order\/r\/([^/]+)/)
  if (tenantMatch?.[1]) {
    const slug = decodeSafe(tenantMatch[1]).trim()
    if (!slug) return "/order"
    return `/order/r/${encodeURIComponent(slug)}`
  }

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
