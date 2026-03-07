"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { FormInput } from "@/components/ui/FormField"

type LaunchProfile = "first-run" | "rush-hour" | "full"

function sanitizeBaseUrl(value: string) {
  const trimmed = value.trim().replace(/\/+$/, "")
  if (!trimmed) return ""
  try {
    const parsed = new URL(trimmed)
    return parsed.toString().replace(/\/$/, "")
  } catch {
    return ""
  }
}

function commandForProfile(
  baseUrl: string,
  tenantSlug: string,
  profile: LaunchProfile
) {
  return `npm run demo:open -- --base-url ${baseUrl} --tenant-slug ${tenantSlug} --profile ${profile}`
}

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], {
    type: "text/plain;charset=utf-8",
  })
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = objectUrl
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(objectUrl)
}

function windowsRunner(command: string) {
  return [
    "@echo off",
    "setlocal",
    `set \"DEMO_CMD=${command.replace(/"/g, '""')}\"`,
    "echo %DEMO_CMD%",
    "set /p =Press Enter to run this command...",
    "echo.",
    "%DEMO_CMD%",
    "echo.",
    "echo Demo launcher finished.",
    "pause",
  ].join("\r\n")
}

function unixRunner(command: string) {
  return [
    "#!/usr/bin/env bash",
    "set -euo pipefail",
    `DEMO_CMD='${command.replace(/'/g, "'\"'\"'")}'`,
    "echo \"$DEMO_CMD\"",
    "read -r -p \"Press Enter to run this command...\"",
    "bash -lc \"$DEMO_CMD\"",
  ].join("\n")
}

export function DemoTerminalLaunchPanel({
  tenantSlug,
}: {
  tenantSlug: string
}) {
  const [detectedBaseUrl, setDetectedBaseUrl] = useState("")
  const [baseUrlInput, setBaseUrlInput] = useState("")
  const [copyState, setCopyState] = useState<string | null>(null)
  const [copyError, setCopyError] = useState<string | null>(null)

  useEffect(() => {
    setDetectedBaseUrl(window.location.origin)
  }, [])
  const normalizedBaseUrl =
    sanitizeBaseUrl(baseUrlInput) || sanitizeBaseUrl(detectedBaseUrl)

  const commands = useMemo(() => {
    const base =
      normalizedBaseUrl || "<YOUR_BASE_URL>"
    return {
      firstRun: commandForProfile(base, tenantSlug, "first-run"),
      rushHour: commandForProfile(base, tenantSlug, "rush-hour"),
      full: commandForProfile(base, tenantSlug, "full"),
      auto:
        "npm run demo:auto",
    }
  }, [normalizedBaseUrl, tenantSlug])

  async function copyCommand(label: string, command: string) {
    setCopyError(null)
    try {
      await navigator.clipboard.writeText(command)
      setCopyState(`${label} copied`)
      window.setTimeout(() => setCopyState(null), 1800)
    } catch {
      setCopyError(
        "Clipboard permission was blocked. Copy manually from the command text."
      )
    }
  }

  return (
    <Card className="space-y-3">
      <h2 className="text-base font-semibold tracking-tight">
        Terminal Launch Commands
      </h2>
      <p className="text-sm text-secondary">
        Browsers cannot open your local terminal with pre-pasted text for
        security reasons. Use copy or download a runner script, then press
        Enter in your terminal.
      </p>
      <FormInput
        label="Base URL"
        value={baseUrlInput}
        onChange={event => setBaseUrlInput(event.target.value)}
        placeholder="https://your-live-url.example"
        hint={
          detectedBaseUrl
            ? `Leave blank to use this site origin: ${detectedBaseUrl}`
            : "Required for demo:open"
        }
      />
      <div className="space-y-2 rounded-xl border border-[var(--border)] surface-secondary p-3">
        <div className="space-y-1">
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted">
            First customer walkthrough
          </div>
          <div className="mono-font text-xs text-[var(--text-primary)]">
            {commands.firstRun}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="quiet"
              className="min-h-[36px]"
              onClick={() => copyCommand("First-run command", commands.firstRun).catch(() => {})}
            >
              Copy command
            </Button>
            <Button
              variant="quiet"
              className="min-h-[36px]"
              onClick={() =>
                downloadTextFile(
                  "run-demo-first-run.cmd",
                  windowsRunner(commands.firstRun)
                )
              }
            >
              Download Windows runner
            </Button>
            <Button
              variant="quiet"
              className="min-h-[36px]"
              onClick={() =>
                downloadTextFile(
                  "run-demo-first-run.sh",
                  unixRunner(commands.firstRun)
                )
              }
            >
              Download macOS/Linux runner
            </Button>
          </div>
        </div>

        <div className="space-y-1">
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted">
            Rush-hour operations
          </div>
          <div className="mono-font text-xs text-[var(--text-primary)]">
            {commands.rushHour}
          </div>
          <Button
            variant="quiet"
            className="min-h-[36px]"
            onClick={() => copyCommand("Rush-hour command", commands.rushHour).catch(() => {})}
          >
            Copy command
          </Button>
        </div>

        <div className="space-y-1">
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted">
            Full all-pages launch
          </div>
          <div className="mono-font text-xs text-[var(--text-primary)]">
            {commands.full}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="quiet"
              className="min-h-[36px]"
              onClick={() => copyCommand("Full launch command", commands.full).catch(() => {})}
            >
              Copy command
            </Button>
            <Button
              variant="quiet"
              className="min-h-[36px]"
              onClick={() =>
                downloadTextFile(
                  "run-demo-full.cmd",
                  windowsRunner(commands.full)
                )
              }
            >
              Download Windows runner
            </Button>
            <Button
              variant="quiet"
              className="min-h-[36px]"
              onClick={() =>
                downloadTextFile(
                  "run-demo-full.sh",
                  unixRunner(commands.full)
                )
              }
            >
              Download macOS/Linux runner
            </Button>
          </div>
        </div>

        <div className="space-y-1">
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted">
            Zero-arg autopilot
          </div>
          <div className="mono-font text-xs text-[var(--text-primary)]">
            {commands.auto}
          </div>
          <Button
            variant="quiet"
            className="min-h-[36px]"
            onClick={() => copyCommand("Autopilot command", commands.auto).catch(() => {})}
          >
            Copy command
          </Button>
        </div>
      </div>

      {copyState ? (
        <div className="status-chip status-chip-neutral inline-flex">
          {copyState}
        </div>
      ) : null}
      {copyError ? (
        <div className="status-chip status-chip-danger inline-flex">
          {copyError}
        </div>
      ) : null}
    </Card>
  )
}
