/**
 * Haptic feedback utility for premium tactile interactions.
 * Uses navigator.vibrate when available, degrades silently.
 */

type HapticPattern = "light" | "medium" | "heavy" | "success" | "error" | "tap" | "confirm" | "addToCart" | "submit"

const patterns: Record<HapticPattern, number | number[]> = {
  light: 10,
  medium: 20,
  heavy: 40,
  tap: 8,
  addToCart: [10, 30, 10],
  confirm: [10, 40, 15],
  submit: [10, 50, 20, 50, 10],
  success: [10, 50, 20, 50, 10],
  error: [30, 20, 30],
}

export function haptic(pattern: HapticPattern = "light") {
  if (typeof navigator === "undefined" || !navigator.vibrate) return
  try {
    navigator.vibrate(patterns[pattern])
  } catch {
    // Vibrate API not supported or blocked — silent fallback
  }
}
