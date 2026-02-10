'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type Item = { id: string; name: string; quantity: number }

export default function CartPage({ params }: { params: { tagId: string } }) {
  const router = useRouter()
  const [items, setItems] = useState<Item[]>([])
  const sessionId = typeof window !== 'undefined' ? localStorage.getItem('sessionId') : null

  const load = () => {
    fetch('/api/cart/get', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId })
    })
      .then(r => r.json())
      .then(d => setItems(d?.items ?? []))
  }

  useEffect(() => {
    if (sessionId) load()
  }, [sessionId])

  const add = async () => {
    await fetch('/api/cart/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, name: 'Item', quantity: 1 })
    })
    load()
  }

  const update = async (id: string, quantity: number) => {
    if (quantity <= 0) return remove(id)
    await fetch('/api/cart/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId: id, quantity })
    })
    load()
  }

  const remove = async (id: string) => {
    await fetch('/api/cart/remove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId: id })
    })
    load()
  }

  const push = async () => {
    const res = await fetch('/api/draft/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId })
    })
    if (res.ok) router.push(`/t/${params.tagId}/table`)
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Your Order</h1>

      {items.map(i => (
        <div key={i.id}>
          {i.name} x{i.quantity}
          <button onClick={() => update(i.id, i.quantity + 1)}>+</button>
          <button onClick={() => update(i.id, i.quantity - 1)}>-</button>
          <button onClick={() => remove(i.id)}>x</button>
        </div>
      ))}

      <button onClick={add}>Add Item</button>
      <button onClick={push}>Add to Table Order</button>
    </div>
  )
}
