import { redirect } from "next/navigation"

export default function CartRedirectPage({
  params,
}: {
  params: { tagId: string }
}) {
  redirect(`/t/${params.tagId}/review`)
}
