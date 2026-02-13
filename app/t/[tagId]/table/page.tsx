'use client'

import { useEffect, useState } from 'react'

export default function TablePage({
  params,
}: {
  params: { tagId: string }
}) {
  const [drafts, setDrafts] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const loadDrafts = async () => {
      try {
        const sessionRes = await fetch('/api/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tagId: params.tagId }),
        })

        if (!sessionRes.ok) {
          const payload = await sessionRes
            .json()
            .catch(() => ({} as { error?: string }))
          throw new Error(payload.error ?? 'SESSION_BOOTSTRAP_FAILED')
        }

        const sessionPayload = await sessionRes.json()
        const tableId =
          typeof sessionPayload?.tableId === 'string'
            ? sessionPayload.tableId
            : ''
        const sessionId =
          typeof sessionPayload?.sessionId === 'string'
            ? sessionPayload.sessionId
            : ''

        if (!tableId || !sessionId) {
          throw new Error('TABLE_CONTEXT_MISSING')
        }

        const tableRes = await fetch('/api/table/get', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tableId,
            sessionId,
          }),
        })

        if (!tableRes.ok) {
          const payload = await tableRes
            .json()
            .catch(() => ({} as { error?: string }))
          throw new Error(payload.error ?? 'TABLE_FETCH_FAILED')
        }

        const nextDrafts = await tableRes.json()
        if (!cancelled) {
          setDrafts(nextDrafts)
        }
      } catch (fetchError) {
        if (!cancelled) {
          setError(
            `Could not load table draft (${String(
              (fetchError as { message?: string })?.message ?? 'unknown'
            )}).`
          )
        }
      }
    }

    void loadDrafts()
    return () => {
      cancelled = true
    }
  }, [params.tagId])

  return (
    <div style={{ padding: 20 }}>
      <h1>Table Order</h1>
      {error && <div>{error}</div>}
      {drafts.flatMap(d =>
        d.items.map((i: any) => (
          <div key={i.id}>
            {i.name} x{i.quantity}
          </div>
        ))
      )}
    </div>
  )
}
