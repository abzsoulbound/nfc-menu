import StaffDashboard from "@/app/staff/page"
import { StaffAuthGate } from "@/components/staff/StaffAuthGate"

export default function TenantDashboardPage() {
  return (
    <StaffAuthGate>
      <StaffDashboard />
    </StaffAuthGate>
  )
}
