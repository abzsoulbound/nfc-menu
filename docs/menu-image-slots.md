# Menu Item Image Priority

Menu cards use this image order:

1. Manager-uploaded item image (`item.image` saved via `SET_ITEM_IMAGE`).
2. AI-generated image URL from item name + description.
3. Base failsafe image: `/public/placeholders/ai-item-failsafe.svg`.

The manager can upload or clear item images from the **Menu Availability Board** in `/manager` and `/admin`.
