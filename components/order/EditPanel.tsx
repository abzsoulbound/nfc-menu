"use client"

import { useState, useMemo, ReactNode } from "react"
import { Modal } from "@/components/ui/Modal"
import { Button } from "@/components/ui/Button"
import { useCartStore } from "@/store/useCartStore"

interface EditPanelProps {
  item: any
  onClose: () => void
}

export default function EditPanel({ item, onClose }: EditPanelProps) {
  const addToCart = useCartStore(state => state.addItem)

  const [quantity, setQuantity] = useState(1)
  const [openSection, setOpenSection] = useState<string | null>("remove")
  const [removed, setRemoved] = useState<string[]>([])

  const total = useMemo(() => {
    return (item.price * quantity).toFixed(2)
  }, [item.price, quantity])

  const toggleRemove = (id: string) => {
    setRemoved(prev =>
      prev.includes(id)
        ? prev.filter(r => r !== id)
        : [...prev, id]
    )
  }

  const handleAdd = () => {
    addToCart({
      ...item,
      quantity,
      removed
    })
    onClose()
  }

  const Section = ({
    id,
    title,
    children
  }: {
    id: string
    title: string
    children: ReactNode
  }) => {
    const isOpen = openSection === id

    return (
      <div className="border-b border-neutral-200">
        <button
          onClick={() => setOpenSection(isOpen ? null : id)}
          className="w-full flex justify-between items-center py-3 text-left text-sm font-semibold"
        >
          <span>{title}</span>
          <span>{isOpen ? "▾" : "▸"}</span>
        </button>

        {isOpen && (
          <div className="pb-3 space-y-2">
            {children}
          </div>
        )}
      </div>
    )
  }

  return (
    <Modal title="Edit Item" onConfirm={handleAdd} onCancel={onClose}>
      <div className="relative w-full max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[85vh] flex flex-col">

        {/* HEADER */}
        <div className="px-4 pt-4 pb-3 border-b border-neutral-200">
          <div className="flex justify-between items-start">
            <button
              onClick={onClose}
              className="text-lg font-medium"
            >
              ✕
            </button>

            <div className="text-base font-semibold">
              £{item.price.toFixed(2)}
            </div>
          </div>

          <div className="flex gap-3 mt-3">
            <img
              src={item.image}
              alt={item.name}
              className="w-20 h-20 object-cover rounded-lg"
            />

            <div className="flex-1 min-w-0">
              <h2 className="text-base font-semibold leading-tight truncate">
                {item.name}
              </h2>

              <p className="text-sm text-neutral-500 line-clamp-2">
                {item.description}
              </p>
            </div>
          </div>
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-hidden px-4">

          {item.removable?.length > 0 && (
            <Section
              id="remove"
              title={`REMOVE INGREDIENTS (${removed.length}/${item.removable.length})`}
            >
              {item.removable.map((opt: any) => (
                <label
                  key={opt.id}
                  className="flex items-center gap-3 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={removed.includes(opt.id)}
                    onChange={() => toggleRemove(opt.id)}
                    className="w-4 h-4"
                  />
                  {opt.label}
                </label>
              ))}
            </Section>
          )}

          {item.included?.length > 0 && (
            <Section
              id="included"
              title="INCLUDED INGREDIENTS"
            >
              <ul className="text-sm text-neutral-600 space-y-1">
                {item.included.map((inc: string, i: number) => (
                  <li key={i}>{inc}</li>
                ))}
              </ul>
            </Section>
          )}

          {item.allergens?.length > 0 && (
            <Section
              id="allergy"
              title="ALLERGY REQUESTS"
            >
              <ul className="text-sm text-neutral-600 space-y-1">
                {item.allergens.map((a: string, i: number) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </Section>
          )}
        </div>

        {/* STICKY ACTION BAR */}
        <div className="border-t border-neutral-200 p-4 space-y-3 bg-white">
          <div className="flex items-center justify-between text-sm font-medium">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setQuantity(q => Math.max(1, q - 1))}
                className="w-8 h-8 border rounded-full"
              >
                −
              </button>

              <span>{quantity}</span>

              <button
                onClick={() => setQuantity(q => q + 1)}
                className="w-8 h-8 border rounded-full"
              >
                +
              </button>
            </div>

            <div>£{total}</div>
          </div>

          <Button
            onClick={handleAdd}
            className="w-full bg-black text-white py-3 rounded-lg text-sm font-semibold"
          >
            Add to Basket • £{total}
          </Button>
        </div>

      </div>
    </Modal>
  )
}
