import { ReactNode } from "react"
import { StaffAuthGate } from "@/components/staff/StaffAuthGate"

export default function StaffLayout({
  children,
}: {
  children: ReactNode
}) {
  return <StaffAuthGate>{children}</StaffAuthGate>
}
