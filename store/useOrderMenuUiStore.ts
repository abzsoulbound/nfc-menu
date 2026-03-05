import { create } from "zustand"

type OrderMenuUiState = {
  reviewOpen: boolean
  canOpenReview: boolean
  openReview: () => void
  closeReview: () => void
  setCanOpenReview: (canOpenReview: boolean) => void
  reset: () => void
}

export const useOrderMenuUiStore = create<OrderMenuUiState>((set, get) => ({
  reviewOpen: false,
  canOpenReview: false,
  openReview: () => {
    if (!get().canOpenReview) return
    set({ reviewOpen: true })
  },
  closeReview: () => set({ reviewOpen: false }),
  setCanOpenReview: canOpenReview =>
    set(state => ({
      canOpenReview,
      reviewOpen: canOpenReview ? state.reviewOpen : false,
    })),
  reset: () => set({ reviewOpen: false, canOpenReview: false }),
}))
