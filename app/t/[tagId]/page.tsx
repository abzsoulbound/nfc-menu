'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function TagPage({ params }: { params: { tagId: string } }) {
  const router = useRouter()

  useEffect(() => {
    const sessionId = localStorage.getItem('sessionId')
    if (sessionId) {
      router.replace(`/t/${params.tagId}/cart`)
      return
    }

    fetch('/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tagId: params.tagId })
    })
      .then(r => r.json())
      .then(d => {
        localStorage.setItem('sessionId', d.sessionId)
        router.replace(`/t/${params.tagId}/cart`)
      })
  }, [params.tagId, router])

  return null
}
