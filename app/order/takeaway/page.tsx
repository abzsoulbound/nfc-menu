import OrderPage from "@/app/order/[id]/page"

export default function TakeawayPage() {
  return <OrderPage params={{ id: "takeaway" }} />
}
