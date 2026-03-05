"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { fetchJson } from "@/lib/fetchJson"

type Seller = {
  id: string
  displayName: string
  contactEmail: string
  country: string
  stripeAccountId: string
  createdAt: string
  updatedAt: string
  status: {
    accountId: string
    readyToReceivePayments: boolean
    onboardingComplete: boolean
    transfersStatus: string
    requirementsStatus: string
  }
}

type Product = {
  id: string
  sellerId: string
  sellerDisplayName: string
  sellerStripeAccountId: string
  stripeProductId: string
  stripePriceId: string
  name: string
  description: string | null
  unitAmount: number
  currency: string
  createdAt: string
  updatedAt: string
}

function formatMoney(unitAmount: number, currency: string) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(unitAmount / 100)
}

export function StripeConnectSampleClient() {
  const searchParams = useSearchParams()
  const [sellers, setSellers] = useState<Seller[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [displayName, setDisplayName] = useState("")
  const [contactEmail, setContactEmail] = useState("")
  const [selectedSellerId, setSelectedSellerId] = useState("")
  const [productName, setProductName] = useState("")
  const [productDescription, setProductDescription] = useState("")
  const [priceInCents, setPriceInCents] = useState("500")
  const [currency, setCurrency] = useState("usd")
  const [quantities, setQuantities] = useState<Record<string, string>>({})

  const selectedSeller = useMemo(
    () => sellers.find(seller => seller.id === selectedSellerId) ?? null,
    [selectedSellerId, sellers]
  )

  const loadSampleData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // The sample keeps UI data simple: fetch sellers and products separately,
      // then join them client-side only where needed for display.
      const [sellerPayload, productPayload] = await Promise.all([
        fetchJson<{ sellers: Seller[] }>("/api/stripe/sample/accounts", {
          cache: "no-store",
        }),
        fetchJson<{ products: Product[] }>("/api/stripe/sample/products", {
          cache: "no-store",
        }),
      ])

      setSellers(sellerPayload.sellers)
      setProducts(productPayload.products)

      if (!selectedSellerId && sellerPayload.sellers[0]) {
        setSelectedSellerId(sellerPayload.sellers[0].id)
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [selectedSellerId])

  useEffect(() => {
    void loadSampleData()
  }, [loadSampleData])

  useEffect(() => {
    const onboarding = searchParams.get("onboarding")
    const checkout = searchParams.get("checkout")
    const reauth = searchParams.get("reauth")

    if (onboarding === "returned") {
      setNotice("Returned from Stripe onboarding. Status is refreshed live below.")
    } else if (checkout === "cancelled") {
      setNotice("Checkout was cancelled before payment completed.")
    } else if (reauth === "1") {
      setNotice("The previous onboarding link expired. Generate a new one below.")
    }
  }, [searchParams])

  async function handleCreateSeller() {
    setSubmitting(true)
    setError(null)
    setNotice(null)

    try {
      const payload = await fetchJson<{ seller: Seller }>(
        "/api/stripe/sample/accounts",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            displayName,
            contactEmail,
          }),
        }
      )

      setDisplayName("")
      setContactEmail("")
      setSelectedSellerId(payload.seller.id)
      setNotice("Connected account created. Launch onboarding next.")
      await loadSampleData()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleStartOnboarding(sellerId: string) {
    setSubmitting(true)
    setError(null)
    setNotice(null)

    try {
      const payload = await fetchJson<{
        link: {
          url: string
        }
      }>(`/api/stripe/sample/accounts/${sellerId}/onboarding-link`, {
        method: "POST",
      })

      window.location.assign(payload.link.url)
    } catch (err) {
      setError((err as Error).message)
      setSubmitting(false)
    }
  }

  async function handleCreateProduct() {
    setSubmitting(true)
    setError(null)
    setNotice(null)

    try {
      await fetchJson<{ product: Product }>("/api/stripe/sample/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sellerId: selectedSellerId,
          name: productName,
          description: productDescription || null,
          priceInCents: Number(priceInCents),
          currency,
        }),
      })

      setProductName("")
      setProductDescription("")
      setPriceInCents("500")
      setCurrency("usd")
      setNotice("Platform product created. It is now visible in the storefront.")
      await loadSampleData()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCheckout(productId: string) {
    setSubmitting(true)
    setError(null)
    setNotice(null)

    try {
      const quantity = Number(quantities[productId] || "1")
      const payload = await fetchJson<{
        session: {
          url: string
        }
      }>("/api/stripe/sample/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          quantity,
        }),
      })

      window.location.assign(payload.session.url)
    } catch (err) {
      setError((err as Error).message)
      setSubmitting(false)
    }
  }

  return (
    <div className="px-4 py-5 md:px-6 md:py-6">
      <div className="mx-auto max-w-[1180px] space-y-4">
        <Card variant="elevated" className="space-y-3">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
            Stripe Connect Sample
          </div>
          <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">
            Connect onboarding, platform products, and hosted checkout
          </h1>
          <p className="max-w-4xl text-sm leading-6 text-secondary md:text-base">
            This sample creates V2 connected accounts, launches onboarding with
            account links, creates products on the platform account, and routes
            customer payments to the selected connected account with a
            destination charge and application fee.
          </p>
          <div className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface-accent)] p-3 text-xs leading-6 text-secondary">
            Webhook endpoint for thin events:{" "}
            <span className="mono-font">/api/stripe/sample/webhooks</span>
            <br />
            Stripe CLI example:
            <br />
            <span className="mono-font">
              stripe listen --thin-events
              {" "}
              &apos;v2.core.account[requirements].updated,v2.core.account[configuration.recipient].capability_status_updated&apos;
              {" "}
              --forward-thin-to http://localhost:3000/api/stripe/sample/webhooks
            </span>
          </div>
        </Card>

        {error && (
          <div className="status-chip status-chip-danger inline-flex">
            {error}
          </div>
        )}

        {notice && (
          <div className="status-chip status-chip-neutral inline-flex">
            {notice}
          </div>
        )}

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
          <div className="space-y-4">
            <Card className="space-y-3">
              <div className="text-sm font-semibold uppercase tracking-[0.14em] text-muted">
                1. Create Connected Account
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1 text-sm">
                  <span className="font-medium">Display name</span>
                  <input
                    className="w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
                    value={displayName}
                    onChange={event => setDisplayName(event.target.value)}
                    placeholder="Sample Seller"
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-medium">Contact email</span>
                  <input
                    className="w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
                    value={contactEmail}
                    onChange={event => setContactEmail(event.target.value)}
                    placeholder="seller@example.com"
                  />
                </label>
              </div>
              <Button
                disabled={submitting || !displayName || !contactEmail}
                onClick={() => handleCreateSeller().catch(() => {})}
              >
                {submitting ? "Working..." : "Create connected account"}
              </Button>
            </Card>

            <Card className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold uppercase tracking-[0.14em] text-muted">
                  2. Onboard Connected Accounts
                </div>
                <Button
                  variant="quiet"
                  disabled={submitting || loading}
                  onClick={() => loadSampleData().catch(() => {})}
                >
                  Refresh statuses
                </Button>
              </div>

              {loading ? (
                <div className="text-sm text-secondary">Loading sample data...</div>
              ) : sellers.length === 0 ? (
                <div className="text-sm text-secondary">
                  No connected accounts yet. Create one first.
                </div>
              ) : (
                <div className="space-y-3">
                  {sellers.map(seller => (
                    <div
                      key={seller.id}
                      className="rounded-[var(--radius-control)] border border-[var(--border)] p-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1 text-sm">
                          <div className="font-semibold">{seller.displayName}</div>
                          <div className="text-secondary">{seller.contactEmail}</div>
                          <div className="mono-font text-xs text-muted">
                            {seller.stripeAccountId}
                          </div>
                        </div>
                        <Button
                          disabled={submitting}
                          onClick={() => handleStartOnboarding(seller.id).catch(() => {})}
                        >
                          Onboard to collect payments
                        </Button>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs">
                        <span className="status-chip status-chip-neutral inline-flex">
                          Transfers: {seller.status.transfersStatus}
                        </span>
                        <span className="status-chip status-chip-neutral inline-flex">
                          Requirements: {seller.status.requirementsStatus}
                        </span>
                        <span className="status-chip status-chip-neutral inline-flex">
                          {seller.status.onboardingComplete
                            ? "Onboarding complete"
                            : "Onboarding incomplete"}
                        </span>
                        <span className="status-chip status-chip-neutral inline-flex">
                          {seller.status.readyToReceivePayments
                            ? "Ready for destination charges"
                            : "Not ready for transfers"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="space-y-3">
              <div className="text-sm font-semibold uppercase tracking-[0.14em] text-muted">
                3. Create Platform Product
              </div>
              <div className="grid gap-3">
                <label className="space-y-1 text-sm">
                  <span className="font-medium">Connected seller</span>
                  <select
                    className="w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
                    value={selectedSellerId}
                    onChange={event => setSelectedSellerId(event.target.value)}
                  >
                    <option value="">Select a seller</option>
                    {sellers.map(seller => (
                      <option key={seller.id} value={seller.id}>
                        {seller.displayName}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-medium">Name</span>
                  <input
                    className="w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
                    value={productName}
                    onChange={event => setProductName(event.target.value)}
                    placeholder="Demo Tasting Menu"
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-medium">Description</span>
                  <textarea
                    className="min-h-[88px] w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
                    value={productDescription}
                    onChange={event => setProductDescription(event.target.value)}
                    placeholder="Short product description for Checkout."
                  />
                </label>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="space-y-1 text-sm">
                    <span className="font-medium">Price (minor units)</span>
                    <input
                      className="w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
                      value={priceInCents}
                      onChange={event => setPriceInCents(event.target.value)}
                      placeholder="500"
                    />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="font-medium">Currency</span>
                    <input
                      className="w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
                      value={currency}
                      onChange={event => setCurrency(event.target.value)}
                      placeholder="usd"
                    />
                  </label>
                </div>
              </div>
              <div className="text-xs text-secondary">
                {selectedSeller
                  ? `Destination charges for this product will transfer funds to ${selectedSeller.displayName}.`
                  : "Pick a seller so the sample can map the product to a connected account."}
              </div>
              <Button
                disabled={
                  submitting ||
                  !selectedSellerId ||
                  !productName ||
                  !priceInCents
                }
                onClick={() => handleCreateProduct().catch(() => {})}
              >
                {submitting ? "Working..." : "Create platform product"}
              </Button>
            </Card>

            <Card className="space-y-3">
              <div className="text-sm font-semibold uppercase tracking-[0.14em] text-muted">
                4. Storefront
              </div>

              {products.length === 0 ? (
                <div className="text-sm text-secondary">
                  No products yet. Create one above to test hosted Checkout.
                </div>
              ) : (
                <div className="space-y-3">
                  {products.map(product => (
                    <div
                      key={product.id}
                      className="rounded-[var(--radius-control)] border border-[var(--border)] p-3"
                    >
                      <div className="space-y-1">
                        <div className="text-base font-semibold">{product.name}</div>
                        {product.description && (
                          <div className="text-sm text-secondary">
                            {product.description}
                          </div>
                        )}
                        <div className="text-sm text-secondary">
                          Sold by {product.sellerDisplayName}
                        </div>
                        <div className="text-sm font-semibold">
                          {formatMoney(product.unitAmount, product.currency)}
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap items-end gap-3">
                        <label className="space-y-1 text-xs text-muted">
                          Quantity
                          <input
                            className="block w-20 rounded-[var(--radius-control)] border border-[var(--border)] bg-transparent px-3 py-2 text-sm text-[var(--text-primary)]"
                            value={quantities[product.id] ?? "1"}
                            onChange={event =>
                              setQuantities(current => ({
                                ...current,
                                [product.id]: event.target.value,
                              }))
                            }
                          />
                        </label>
                        <Button
                          disabled={submitting}
                          onClick={() => handleCheckout(product.id).catch(() => {})}
                        >
                          Buy with hosted Checkout
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
