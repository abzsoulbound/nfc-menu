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
    const tableId =
      typeof window !== 'undefined'
        ? localStorage.getItem('tableId')
        : null
    if (!tableId) return

    const sessionId =
      typeof window !== 'undefined'
        ? (
            localStorage.getItem(
              `nfc-pos.tag-session.${params.tagId}`
            ) ?? localStorage.getItem('sessionId')
          )
        : null

    fetch('/api/table/get', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tableId,
        sessionId,
      })
    })
      .then(async r => {
        if (!r.ok) {
          const payload = await r
            .json()
            .catch(() => ({} as { error?: string }))
          throw new Error(payload.error ?? 'TABLE_FETCH_FAILED')
        }
        return r.json()
      })
      .then(setDrafts)
      .catch(fetchError => {
        setError(
          `Could not load table draft (${String(
            fetchError?.message ?? 'unknown'
          )}).`
        )
      })
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
