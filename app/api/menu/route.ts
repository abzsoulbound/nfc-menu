import { NextResponse } from "next/server"
import { isMenuLocked } from "@/lib/menu"
import { menu } from "@/lib/menu-data"

export async function GET() {
  return NextResponse.json({
    menu,
    locked: isMenuLocked(),
  })
}
