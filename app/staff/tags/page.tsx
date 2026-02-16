"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"
import { Divider } from "@/components/ui/Divider"
import { Button } from "@/components/ui/Button"
import { TagList } from "@/components/staff/TagList"
import { formatTableNumber } from "@/lib/tableCatalog"

type Tag = {
  id: string
  active: boolean
  tableNumber: number | null
  activeSessionCount: number
  totalSessionCount: number
  lastSeenAt: string
}

export default function StaffTagsPage() {
  const [tags, setTags] = useState<Tag[]>([])
  const [selectedTag, setSelectedTag] = useState<Tag | null>(null)
  const [newTagId, setNewTagId] = useState("")
  const [registering, setRegistering] = useState(false)
  const [registerError, setRegisterError] = useState<string | null>(
    null
  )
  const [registerNotice, setRegisterNotice] = useState<string | null>(
    null
  )

  async function parseArrayResponse<T>(
    res: Response
  ): Promise<T[]> {
    const raw = await res.text()
    if (!raw) return []

    try {
      const parsed = JSON.parse(raw) as unknown
      return Array.isArray(parsed) ? (parsed as T[]) : []
    } catch {
      return []
    }
  }

  async function fetchTags() {
    try {
      const res = await fetch("/api/tags", { cache: "no-store" })
      const data = await parseArrayResponse<Tag>(res)
      setTags(data)
    } catch {
      // keep existing values on transient failures
    }
  }

  async function parseObjectResponse<T>(
    res: Response
  ): Promise<T | null> {
    const raw = await res.text()
    if (!raw) return null

    try {
      const parsed = JSON.parse(raw) as unknown
      if (!parsed || typeof parsed !== "object") return null
      return parsed as T
    } catch {
      return null
    }
  }

  useEffect(() => {
    fetchTags()
    // Tags are mostly static; poll every 30 seconds (or remove if tags are configured once)
    const interval = setInterval(() => {
      fetchTags()
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  function minutesSince(ts: string) {
    return Math.floor(
      (Date.now() - new Date(ts).getTime()) / 60000
    )
  }

  async function registerTag() {
    const tagId = newTagId.trim()
    if (!tagId) {
      setRegisterError("Enter an NFC number.")
      return
    }

    setRegistering(true)
    setRegisterError(null)
    setRegisterNotice(null)
    try {
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagId }),
      })

      const payload = await parseObjectResponse<{
        error?: string
        created?: boolean
      }>(res)

      if (!res.ok) {
        if (payload?.error === "BAD_REQUEST") {
          setRegisterError("Invalid NFC number.")
        } else {
          setRegisterError("Could not register NFC number.")
        }
        return
      }

      setRegisterNotice(
        payload?.created
          ? "NFC number registered."
          : "NFC number already registered."
      )
      setNewTagId("")
      fetchTags()
    } catch {
      setRegisterError("Could not register NFC number.")
    } finally {
      setRegistering(false)
    }
  }

  if (selectedTag) {
    return (
      <div className="p-4 space-y-4">
        <Card>
          <div className="flex justify-between items-center">
            <div className="font-mono text-sm">
              Tag {selectedTag.id}
            </div>
            <div className="flex gap-2">
              {!selectedTag.active && <Badge>inactive</Badge>}
              {selectedTag.activeSessionCount > 3 && (
                <Badge>many sessions</Badge>
              )}
            </div>
          </div>
        </Card>

        <Divider />

        <Card>
          <div className="space-y-1">
            <div className="text-sm opacity-70">
              Current table
            </div>
            <div className="text-lg font-semibold">
              {selectedTag.tableNumber === null
                ? "Unassigned"
                : `Table ${formatTableNumber(selectedTag.tableNumber)}`}
            </div>
          </div>
        </Card>

        <Card>
          <div className="space-y-1">
            <div className="text-sm opacity-70">
              Lifetime sessions
            </div>
            <div className="text-lg font-semibold">
              {selectedTag.totalSessionCount}
            </div>
          </div>
        </Card>

        <Card
          className="cursor-pointer text-center opacity-70"
          onClick={() => setSelectedTag(null)}
        >
          Back to tags
        </Card>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      <Card>
        <div className="space-y-3">
          <div className="text-lg font-semibold">
            Register NFC number
          </div>
          <div className="text-sm opacity-70">
            Add printed NFC numbers to the registry before service starts.
          </div>

          <input
            className="input"
            value={newTagId}
            onChange={event => {
              setNewTagId(event.target.value)
              setRegisterError(null)
              setRegisterNotice(null)
            }}
            placeholder="Example: NFC-017"
            disabled={registering}
          />

          <Button onClick={registerTag} disabled={registering}>
            {registering ? "Registering..." : "Register NFC"}
          </Button>

          {registerError && (
            <div className="text-sm text-red-400">
              {registerError}
            </div>
          )}
          {registerNotice && (
            <div className="text-sm opacity-70">
              {registerNotice}
            </div>
          )}
        </div>
      </Card>

      <Divider />

      <TagList
        tags={tags}
        onSelect={setSelectedTag}
      />

      {tags.length === 0 && (
        <div className="opacity-60 text-center">
          No active NFC tags
        </div>
      )}
    </div>
  )
}
