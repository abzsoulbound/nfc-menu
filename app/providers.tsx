"use client"

import { ReactNode, useEffect } from "react"
import { useSessionStore } from "@/store/useSessionStore"
import { useCartStore } from "@/store/useCartStore"
import { useStaffStore } from "@/store/useStaffStore"
import { useUIStore } from "@/store/useUIStore"
import { ToastProvider } from "@/components/ui/Toast"
import { ModalProvider } from "@/components/ui/Modal"
import { flushQueuedOrders } from "@/lib/offlineOrders"

/*
APPLICATION-WIDE PROVIDERS

This file is mounted exactly once by app/layout.tsx.
It establishes all client-side state containers and global UI services.

Key invariant:
- User session = person
- Session identity is per-browser and never reset implicitly.
*/

export function Providers({ children }: { children: ReactNode }) {
  const hydrateSession = useSessionStore(s => s.hydrate)
  const hydrateCart = useCartStore(s => s.hydrate)
  const hydrateStaff = useStaffStore(s => s.hydrate)
  const hydrateUI = useUIStore(s => s.hydrate)

  useEffect(() => {
    /*
      On first client mount:
      - Hydrate any previously persisted session.
      - Hydrate all client-side stores from persisted state.
      - Do NOT perform any table or order mutations here.
    */
    hydrateSession()
    hydrateCart()
    hydrateStaff()
    hydrateUI()

    flushQueuedOrders().catch(() => {
      // Best-effort background sync for queued offline orders.
    })
  }, [hydrateSession, hydrateCart, hydrateStaff, hydrateUI])

  useEffect(() => {
    const onOnline = () => {
      flushQueuedOrders().catch(() => {
        // Keep queue for next connectivity recovery.
      })
    }

    window.addEventListener("online", onOnline)
    return () => window.removeEventListener("online", onOnline)
  }, [])

  return (
    <ToastProvider>
      <ModalProvider>
        {children}
      </ModalProvider>
    </ToastProvider>
  )
}
