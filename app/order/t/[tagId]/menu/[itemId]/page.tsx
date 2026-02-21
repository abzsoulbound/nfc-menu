import TagPage from "../../page"

export default function MenuItemPage({
  params,
}: {
  params: { tagId: string; itemId: string }
}) {
  return <TagPage params={{ tagId: params.tagId, itemId: params.itemId }} />
}
