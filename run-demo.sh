#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${DEMO_BASE_URL:-https://fable-stores-nfc-menu.vercel.app}"
TENANT_SLUG="${DEMO_TENANT_SLUG:-demo}"
PROFILE="${1:-first-run}"

case "$PROFILE" in
  first-run)
    FEED="first-run"
    ;;
  rush-hour)
    FEED="rush-hour"
    ;;
  full|full-story)
    PROFILE="full"
    FEED="full-story"
    ;;
  *)
    PROFILE="first-run"
    FEED="first-run"
    ;;
esac

if command -v npm >/dev/null 2>&1; then
  if npm run demo:open -- --base-url "$BASE_URL" --tenant-slug "$TENANT_SLUG" --profile "$PROFILE" --auto-feed --auto-next; then
    echo "Demo launch complete."
    exit 0
  fi
fi

if command -v open >/dev/null 2>&1; then
  OPENER="open"
elif command -v xdg-open >/dev/null 2>&1; then
  OPENER="xdg-open"
else
  echo "No browser opener found (open or xdg-open)."
  exit 1
fi

URL="${BASE_URL}/r/${TENANT_SLUG}?next=/demo?feed=${FEED}%26autoNext=1"
"$OPENER" "$URL" >/dev/null 2>&1 &
echo "Opened fallback guided page: $URL"
