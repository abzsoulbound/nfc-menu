"use client"

import { useEffect, useState } from "react"
import {
  cloneDemoSetupConfig,
  DEFAULT_DEMO_SETUP_CONFIG,
  DEMO_SETUP_STORAGE_KEY,
  DEMO_SETUP_UPDATED_EVENT,
  sanitizeDemoSetupConfig,
  type DemoSetupConfig,
} from "@/lib/demoSetup"

function canUseBrowserStorage() {
  return typeof window !== "undefined" && !!window.localStorage
}

export function readStoredDemoSetupConfig() {
  if (!canUseBrowserStorage()) {
    return cloneDemoSetupConfig(DEFAULT_DEMO_SETUP_CONFIG)
  }

  try {
    const raw = window.localStorage.getItem(DEMO_SETUP_STORAGE_KEY)
    if (!raw) {
      return cloneDemoSetupConfig(DEFAULT_DEMO_SETUP_CONFIG)
    }
    return sanitizeDemoSetupConfig(JSON.parse(raw))
  } catch {
    return cloneDemoSetupConfig(DEFAULT_DEMO_SETUP_CONFIG)
  }
}

function dispatchUpdateEvent() {
  if (typeof window === "undefined") return
  window.dispatchEvent(new Event(DEMO_SETUP_UPDATED_EVENT))
}

export function persistDemoSetupConfig(value: DemoSetupConfig) {
  const sanitized = sanitizeDemoSetupConfig(value)
  if (!canUseBrowserStorage()) {
    return sanitized
  }

  try {
    window.localStorage.setItem(
      DEMO_SETUP_STORAGE_KEY,
      JSON.stringify(sanitized)
    )
    dispatchUpdateEvent()
  } catch {
    // Ignore storage failures in restricted contexts.
  }

  return sanitized
}

export function resetDemoSetupConfig() {
  const defaults = cloneDemoSetupConfig(DEFAULT_DEMO_SETUP_CONFIG)
  if (!canUseBrowserStorage()) {
    return defaults
  }

  try {
    window.localStorage.removeItem(DEMO_SETUP_STORAGE_KEY)
    dispatchUpdateEvent()
  } catch {
    // Ignore storage failures in restricted contexts.
  }

  return defaults
}

export function useDemoSetupConfig() {
  const [config, setConfig] = useState<DemoSetupConfig>(() =>
    cloneDemoSetupConfig(DEFAULT_DEMO_SETUP_CONFIG)
  )

  useEffect(() => {
    setConfig(readStoredDemoSetupConfig())

    function refreshFromStorage() {
      setConfig(readStoredDemoSetupConfig())
    }

    window.addEventListener("storage", refreshFromStorage)
    window.addEventListener(DEMO_SETUP_UPDATED_EVENT, refreshFromStorage)

    return () => {
      window.removeEventListener("storage", refreshFromStorage)
      window.removeEventListener(
        DEMO_SETUP_UPDATED_EVENT,
        refreshFromStorage
      )
    }
  }, [])

  return config
}
