import StaffDashboard from "@/app/staff/page"
import { StaffAuthGate } from "@/components/staff/StaffAuthGate"
import { Divider } from "@/components/ui/Divider"
import { MenuManager } from "@/components/staff/MenuManager"

export default function AdminPage() {
  return (
    <StaffAuthGate>
      <div className="p-4 space-y-6">
        <StaffDashboard />
        <Divider />
        <MenuManager />
      </div>
    </StaffAuthGate>
  )
}
