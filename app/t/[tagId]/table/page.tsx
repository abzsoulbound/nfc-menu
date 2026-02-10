'use client'

import { useEffect, useState } from 'react'

export default function TablePage() {
  const [drafts, setDrafts] = useState<any[]>([])
  const tableId = typeof window !== 'undefined' ? localStorage.getItem('tableId') : null

  useEffect(() => {
    if (!tableId) return

    fetch('/api/table/get', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tableId })
    })
      .then(r => r.json())
      .then(setDrafts)
  }, [tableId])

  return (
    <div style={{ padding: 20 }}>
      <h1>Table Order</h1>
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
