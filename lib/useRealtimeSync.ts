"use client"

import { useEffect, useRef } from "react"

export function useRealtimeSync(
  onEvent: () => void,
  sessionId?: string | null
) {
  const onEventRef = useRef(onEvent)

  useEffect(() => {
    onEventRef.current = onEvent
  }, [onEvent])

  useEffect(() => {
    let cancelled = false
    let source: EventSource | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let emitTimer: ReturnType<typeof setTimeout> | null = null
    const normalizedSessionId = sessionId?.trim()
    const shouldConnect =
      sessionId === undefined || (normalizedSessionId ?? "") !== ""
    if (!shouldConnect) {
      return () => {}
    }
    const streamPath = normalizedSessionId
      ? `/api/stream?sessionId=${encodeURIComponent(normalizedSessionId)}`
      : "/api/stream"

    function clearReconnectTimer() {
      if (reconnectTimer !== null) {
        clearTimeout(reconnectTimer)
        reconnectTimer = null
      }
    }

    function scheduleEmit() {
      if (cancelled || emitTimer !== null) return
      emitTimer = setTimeout(() => {
        emitTimer = null
        if (cancelled) return
        onEventRef.current()
      }, 150)
    }

    function connect() {
      source?.close()
      source = new EventSource(streamPath)
      source.onmessage = scheduleEmit
      source.onerror = () => {
        if (cancelled) return
        source?.close()
        clearReconnectTimer()
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null
          connect()
        }, 1500)
      }
    }

    connect()
    return () => {
      cancelled = true
      clearReconnectTimer()
      if (emitTimer !== null) {
        clearTimeout(emitTimer)
        emitTimer = null
      }
      source?.close()
    }
  }, [sessionId])
}
