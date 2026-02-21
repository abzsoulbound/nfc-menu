"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"

type RestaurantSummary = {
  id: string
  slug: string
  name: string
  domain: string | null
  vatRate: number
  serviceCharge: number
  stats?: {
    menuItems: number
    tableAssignments: number
    staffUsers: number
  }
}

type FormState = {
  slug: string
  name: string
  logoUrl: string
  primaryColor: string
  secondaryColor: string
  domain: string
  vatRate: string
  serviceCharge: string
  tableNumbers: string
  tableCount: string
  seedMenu: boolean
}

const defaultForm: FormState = {
  slug: "",
  name: "",
  logoUrl: "",
  primaryColor: "#12649a",
  secondaryColor: "#d5e4ee",
  domain: "",
  vatRate: "0.2",
  serviceCharge: "0",
  tableNumbers: "",
  tableCount: "20",
  seedMenu: true,
}

export function RestaurantOnboarding() {
  const [form, setForm] = useState<FormState>(defaultForm)
  const [restaurants, setRestaurants] = useState<RestaurantSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    async function loadRestaurants() {
      try {
        const res = await fetch("/api/restaurants", { cache: "no-store" })
        if (!res.ok) return
        const payload = (await res.json()) as {
          restaurants?: RestaurantSummary[]
        }
        if (!active) return
        setRestaurants(Array.isArray(payload.restaurants) ? payload.restaurants : [])
      } finally {
        if (active) setLoading(false)
      }
    }
    void loadRestaurants()
    return () => {
      active = false
    }
  }, [])

  async function submit() {
    if (submitting) return
    setSubmitting(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch("/api/restaurants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: form.slug,
          name: form.name,
          logoUrl: form.logoUrl || null,
          primaryColor: form.primaryColor || null,
          secondaryColor: form.secondaryColor || null,
          domain: form.domain || null,
          vatRate: Number(form.vatRate),
          serviceCharge: Number(form.serviceCharge),
          tableNumbers: form.tableNumbers || null,
          tableCount: Number(form.tableCount),
          seedMenu: form.seedMenu,
        }),
      })

      if (!res.ok) {
        setError("Could not create restaurant. Check slug/domain uniqueness.")
        return
      }

      const payload = (await res.json()) as {
        restaurant?: { slug?: string; name?: string }
      }
      setSuccess(
        payload.restaurant?.name
          ? `${payload.restaurant.name} created successfully.`
          : "Restaurant created."
      )
      setForm(defaultForm)

      const refresh = await fetch("/api/restaurants", { cache: "no-store" })
      if (refresh.ok) {
        const listPayload = (await refresh.json()) as {
          restaurants?: RestaurantSummary[]
        }
        setRestaurants(
          Array.isArray(listPayload.restaurants)
            ? listPayload.restaurants
            : []
        )
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-3">
      <Card>
        <div className="text-lg font-semibold">Onboard New Restaurant</div>
        <div className="text-sm opacity-70">
          Create tenant branding, table setup, VAT/service charge defaults, and
          initial menu in one step.
        </div>

        <div className="grid gap-2 mt-2">
          <input
            className="input"
            placeholder="Slug (e.g. marlos)"
            value={form.slug}
            onChange={event =>
              setForm(current => ({ ...current, slug: event.target.value }))
            }
          />
          <input
            className="input"
            placeholder="Restaurant name"
            value={form.name}
            onChange={event =>
              setForm(current => ({ ...current, name: event.target.value }))
            }
          />
          <input
            className="input"
            placeholder="Logo URL"
            value={form.logoUrl}
            onChange={event =>
              setForm(current => ({ ...current, logoUrl: event.target.value }))
            }
          />
          <input
            className="input"
            placeholder="Primary color (#hex)"
            value={form.primaryColor}
            onChange={event =>
              setForm(current => ({ ...current, primaryColor: event.target.value }))
            }
          />
          <input
            className="input"
            placeholder="Secondary color (#hex)"
            value={form.secondaryColor}
            onChange={event =>
              setForm(current => ({ ...current, secondaryColor: event.target.value }))
            }
          />
          <input
            className="input"
            placeholder="Domain (optional)"
            value={form.domain}
            onChange={event =>
              setForm(current => ({ ...current, domain: event.target.value }))
            }
          />
          <input
            className="input"
            placeholder="VAT rate (e.g. 0.2)"
            value={form.vatRate}
            onChange={event =>
              setForm(current => ({ ...current, vatRate: event.target.value }))
            }
          />
          <input
            className="input"
            placeholder="Service charge (e.g. 0.12)"
            value={form.serviceCharge}
            onChange={event =>
              setForm(current => ({
                ...current,
                serviceCharge: event.target.value,
              }))
            }
          />
          <input
            className="input"
            placeholder="Exact tables (e.g. 1-12,14,16)"
            value={form.tableNumbers}
            onChange={event =>
              setForm(current => ({ ...current, tableNumbers: event.target.value }))
            }
          />
          <input
            className="input"
            placeholder="Table count"
            value={form.tableCount}
            onChange={event =>
              setForm(current => ({ ...current, tableCount: event.target.value }))
            }
          />
          <label className="text-sm">
            <input
              type="checkbox"
              checked={form.seedMenu}
              onChange={event =>
                setForm(current => ({ ...current, seedMenu: event.target.checked }))
              }
            />{" "}
            Seed default menu template
          </label>
        </div>

        {error && <div className="text-sm text-red-400 mt-1">{error}</div>}
        {success && <div className="text-sm mt-1">{success}</div>}

        <div className="mt-2">
          <Button onClick={submit} disabled={submitting}>
            {submitting ? "Creating..." : "Create Restaurant"}
          </Button>
        </div>
      </Card>

      <Card>
        <div className="text-lg font-semibold">Tenants</div>
        {loading ? (
          <div className="text-sm opacity-70">Loading…</div>
        ) : restaurants.length === 0 ? (
          <div className="text-sm opacity-70">No restaurants configured.</div>
        ) : (
          <div className="space-y-2">
            {restaurants.map(restaurant => (
              <div
                key={restaurant.id}
                className="border rounded p-2 text-sm"
              >
                <div className="font-semibold">
                  {restaurant.name} ({restaurant.slug})
                </div>
                <div className="opacity-70">
                  VAT {restaurant.vatRate} · Service {restaurant.serviceCharge}
                </div>
                <div className="opacity-70">
                  Tables: {restaurant.stats?.tableAssignments ?? 0} · Menu items:{" "}
                  {restaurant.stats?.menuItems ?? 0}
                </div>
                <div className="opacity-70">
                  Order URL:{" "}
                  <code>/order/t/1</code>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
