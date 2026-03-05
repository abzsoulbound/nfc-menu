const path = require("path");
const express = require("express");
const dotenv = require("dotenv");
const Stripe = require("stripe");

dotenv.config({ path: path.join(__dirname, ".env"), quiet: true });

function need(name, note) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required. ${note} Copy examples/stripe-connect-express-demo/.env.example to examples/stripe-connect-express-demo/.env.`);
  }
  return value;
}

const STRIPE_SECRET_KEY = need("STRIPE_SECRET_KEY", "Set it to your Stripe platform secret key.");
const BASE_URL = need("BASE_URL", "Set it to this app's public URL, for example http://localhost:3001.");
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";
const PORT = Number(process.env.PORT || 3001);

// Use one shared Stripe client for every request. The SDK chooses the API version.
const stripeClient = new Stripe(STRIPE_SECRET_KEY);

// Demo-only in-memory storage for sellerId -> account.id and recent webhook events.
const store = { nextSeller: 1, sellers: new Map(), webhookLog: [] };

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function money(amount, currency) {
  if (!Number.isFinite(amount)) return "Unknown";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: (currency || "usd").toUpperCase(),
  }).format(amount / 100);
}

function sellerId() {
  return `seller_${store.nextSeller++}`;
}

function mustSeller(id) {
  const seller = store.sellers.get(id);
  if (!seller) {
    const error = new Error(`Seller ${id} was not found.`);
    error.statusCode = 404;
    throw error;
  }
  return seller;
}

function allSellers() {
  return Array.from(store.sellers.values()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function priceShape(product) {
  const price = product?.default_price && typeof product.default_price === "object" ? product.default_price : null;
  const fromMeta = Number(product?.metadata?.unit_amount_cents);
  return {
    unitAmount: Number.isFinite(fromMeta) && fromMeta > 0 ? fromMeta : price?.unit_amount ?? null,
    currency: product?.metadata?.currency || price?.currency || null,
  };
}

async function liveSellerStatus(seller) {
  // Always fetch status live from Stripe, never from memory.
  const account = await stripeClient.v2.core.accounts.retrieve(seller.stripeAccountId, {
    include: ["configuration.recipient", "requirements"],
  });
  const transfers = account?.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers?.status || "unknown";
  const requirements = account?.requirements?.summary?.minimum_deadline?.status || "none_due";
  return {
    ...seller,
    stripeTransfersStatus: transfers,
    requirementsStatus: requirements,
    readyToReceivePayments: transfers === "active",
    onboardingComplete: requirements !== "currently_due" && requirements !== "past_due",
  };
}

async function safeLiveSellerStatus(seller) {
  try {
    return await liveSellerStatus(seller);
  } catch (error) {
    return {
      ...seller,
      stripeTransfersStatus: "unavailable",
      requirementsStatus: "unavailable",
      readyToReceivePayments: false,
      onboardingComplete: false,
      liveStatusError: error.message,
    };
  }
}

async function bestEffortDeleteStripeAccount(stripeAccountId) {
  const deleteV1 = stripeClient?.accounts?.del;
  if (typeof deleteV1 === "function") {
    await deleteV1.call(stripeClient.accounts, stripeAccountId);
    return "Stripe connected account deletion requested. Some accounts may remain visible in Stripe until fully closed by Stripe.";
  }

  const closeV1 = stripeClient?.accounts?.reject;
  if (typeof closeV1 === "function") {
    await closeV1.call(stripeClient.accounts, stripeAccountId, { reason: "other" });
    return "Stripe connected account closure requested.";
  }

  return "Stripe account deletion is not available in this SDK path. Removed seller from demo store only.";
}

async function storefrontProducts() {
  const response = await stripeClient.products.list({
    limit: 100,
    active: true,
    expand: ["data.default_price"],
  });
  return response.data
    .map((product) => {
      const price = priceShape(product);
      return {
        id: product.id,
        name: product.name,
        description: product.description || "",
        connectedAccountId: product.metadata?.connected_account_id || "",
        unitAmount: price.unitAmount,
        currency: price.currency,
      };
    })
    .filter((product) => product.connectedAccountId);
}

async function storefrontProduct(productId) {
  const product = await stripeClient.products.retrieve(productId, { expand: ["default_price"] });
  const price = priceShape(product);
  const connectedAccountId = product.metadata?.connected_account_id || "";
  if (!connectedAccountId) {
    const error = new Error(`Product ${product.id} is missing metadata.connected_account_id.`);
    error.statusCode = 400;
    throw error;
  }
  if (!price.unitAmount || !price.currency) {
    const error = new Error(`Product ${product.id} is missing price metadata.`);
    error.statusCode = 400;
    throw error;
  }
  return {
    id: product.id,
    name: product.name,
    description: product.description || "",
    connectedAccountId,
    unitAmount: price.unitAmount,
    currency: price.currency,
  };
}

function view({ active, title, subtitle, body, notice = "" }) {
  const nav = [
    ["/", "Storefront"],
    ["/sellers", "Sellers"],
    ["/products/new", "Create Product"],
  ]
    .map(([href, label]) => `<a class="${href === active ? "nav on" : "nav"}" href="${href}">${label}</a>`)
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${esc(title)}</title>
<style>
:root{color-scheme:dark;--bg:#0b1117;--panel:#121a24;--line:#223142;--text:#f5f7fb;--muted:#9ba9bc;--accent:#f2b66d;--accent2:#f59e0b;--bad:#f87171;--ok:#34d399}
*{box-sizing:border-box}body{margin:0;font-family:ui-sans-serif,system-ui,Segoe UI,sans-serif;background:radial-gradient(circle at top right,rgba(245,158,11,.12),transparent 30%),linear-gradient(180deg,#081018,#0b1117);color:var(--text)}
a{color:inherit}.wrap{max-width:1080px;margin:0 auto;padding:24px}.top{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:16px 18px;border:1px solid var(--line);border-radius:18px;background:rgba(10,16,24,.9)}.brand{font-weight:700}.nav{padding:10px 12px;border-radius:999px;text-decoration:none;color:var(--muted)}.nav.on,.nav:hover{background:rgba(242,182,109,.12);color:var(--text)}.hero{padding:24px 0 12px}.eyebrow{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--accent)}h1{margin:0 0 10px;font-size:clamp(30px,5vw,52px)}p{line-height:1.55}.sub{color:var(--muted);max-width:760px}.note{margin-top:14px;padding:12px 14px;border:1px solid rgba(242,182,109,.2);border-radius:14px;background:rgba(242,182,109,.08)}.grid{display:grid;gap:16px}.two{grid-template-columns:repeat(auto-fit,minmax(280px,1fr))}.card{padding:20px;border:1px solid var(--line);border-radius:20px;background:linear-gradient(180deg,rgba(18,26,36,.96),rgba(11,17,23,.96))}.meta{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));margin-top:14px}.tile{padding:12px;border:1px solid rgba(148,163,184,.14);border-radius:14px;background:rgba(8,14,20,.7)}.k{display:block;font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:6px}.v{font-weight:700}.stack{display:grid;gap:16px}.empty{padding:18px;border:1px dashed rgba(148,163,184,.25);border-radius:16px;color:var(--muted)}label{display:grid;gap:8px;color:var(--muted);font-size:14px;margin-bottom:12px}input,textarea,select{width:100%;padding:11px 12px;border-radius:12px;border:1px solid rgba(148,163,184,.22);background:#0a1016;color:var(--text);font:inherit}textarea{min-height:88px;resize:vertical}button,.btn{display:inline-flex;align-items:center;justify-content:center;padding:11px 14px;border:0;border-radius:12px;background:linear-gradient(135deg,var(--accent),var(--accent2));color:#1c1408;font-weight:700;font:inherit;text-decoration:none;cursor:pointer}.btn.alt{background:rgba(148,163,184,.14);color:var(--text)}.row{display:flex;gap:10px;flex-wrap:wrap}.pill{display:inline-flex;padding:6px 10px;border-radius:999px;font-size:12px;font-weight:700;background:rgba(148,163,184,.12);color:var(--muted)}.pill.ok{background:rgba(52,211,153,.14);color:#d0fff2}.pill.warn{background:rgba(242,182,109,.12);color:#ffe5bf}.error{color:var(--bad)}pre{margin:0;white-space:pre-wrap;word-break:break-word;color:#d8e7fb}@media(max-width:720px){.top{flex-direction:column;align-items:flex-start}}
</style>
</head>
<body><div class="wrap"><div class="top"><div class="brand">Stripe Connect Demo</div><div>${nav}</div></div><header class="hero"><div class="eyebrow">Express + Stripe</div><h1>${esc(title)}</h1><p class="sub">${esc(subtitle)}</p>${notice ? `<div class="note">${notice}</div>` : ""}</header>${body}</div></body>
</html>`;
}

function flash(res, href, message) {
  const joiner = href.includes("?") ? "&" : "?";
  res.redirect(303, `${href}${joiner}notice=${encodeURIComponent(message)}`);
}

const app = express();
// Webhooks need the raw body so Stripe signature verification can work.
app.post("/webhooks/stripe", express.raw({ type: "application/json" }), async (req, res) => {
  if (!STRIPE_WEBHOOK_SECRET) {
    return res.status(400).send("STRIPE_WEBHOOK_SECRET is missing. Set it before testing webhook signatures.");
  }

  const signature = req.headers["stripe-signature"];
  if (!signature) {
    return res.status(400).send("Missing Stripe-Signature header.");
  }

  try {
    // Newer SDKs expose parseEventNotification(); some examples still call it parseThinEvent().
    const thinEvent = typeof stripeClient.parseThinEvent === "function"
      ? stripeClient.parseThinEvent(req.body, signature, STRIPE_WEBHOOK_SECRET)
      : stripeClient.parseEventNotification(req.body, signature, STRIPE_WEBHOOK_SECRET);

    // Thin events only include a small shell. Fetch the full event from Stripe before switching on type.
    const event = typeof thinEvent.fetchEvent === "function"
      ? await thinEvent.fetchEvent()
      : await stripeClient.v2.core.events.retrieve(thinEvent.id);

    switch (event.type) {
      case "v2.core.account[requirements].updated":
        store.webhookLog.unshift(`[${new Date().toISOString()}] Requirements updated (${event.id})`);
        break;
      case "v2.core.account[recipient].capability_status_updated":
      case "v2.core.account[configuration.recipient].capability_status_updated":
        store.webhookLog.unshift(`[${new Date().toISOString()}] Recipient capability updated (${event.id})`);
        break;
      default:
        store.webhookLog.unshift(`[${new Date().toISOString()}] Ignored ${event.type}`);
        break;
    }

    store.webhookLog = store.webhookLog.slice(0, 10);
    res.json({ received: true, type: event.type });
  } catch (error) {
    res.status(400).send(`Webhook signature verification failed: ${error.message}`);
  }
});

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.get("/", async (req, res, next) => {
  try {
    const products = await storefrontProducts();
    const body = products.length
      ? `<div class="grid two">${products
          .map((product) => `
            <section class="card">
              <div class="stack">
                <div>
                  <h2 style="margin:0 0 6px">${esc(product.name)}</h2>
                  <p style="margin:0">${esc(product.description || "No description provided.")}</p>
                </div>
                <div class="meta">
                  <div class="tile"><span class="k">Product ID</span><span class="v">${esc(product.id)}</span></div>
                  <div class="tile"><span class="k">Connected Account</span><span class="v">${esc(product.connectedAccountId)}</span></div>
                  <div class="tile"><span class="k">Price</span><span class="v">${esc(money(product.unitAmount, product.currency))}</span></div>
                </div>
                <form method="post" action="/checkout/${encodeURIComponent(product.id)}">
                  <button type="submit">Buy with hosted Checkout</button>
                </form>
              </div>
            </section>
          `)
          .join("")}</div>`
      : `<section class="card"><div class="empty">No platform products exist yet. Create a seller, then create a product.</div></section>`;

    res.send(view({
      active: "/",
      title: "Storefront",
      subtitle: "All products are created on the platform account. Checkout uses destination charges and a 5% application fee.",
      notice: req.query.notice ? esc(req.query.notice) : "",
      body,
    }));
  } catch (error) {
    next(error);
  }
});

app.get("/sellers", async (req, res, next) => {
  try {
    const sellers = await Promise.all(allSellers().map((seller) => safeLiveSellerStatus(seller)));
    const notice = String(req.query.notice || "");
    const hasDeleteResult = notice.includes("deleted from demo store");
    const deleteResultState = hasDeleteResult
      ? /skipped|not available/i.test(notice)
        ? "warn"
        : "ok"
      : "";
    const deleteResultLabel = hasDeleteResult
      ? deleteResultState === "ok"
        ? "Stripe cleanup: completed"
        : "Stripe cleanup: skipped"
      : "";
    const cards = sellers.length
      ? sellers
          .map((seller) => `
            <section class="card">
              <div class="row" style="justify-content:space-between;align-items:center">
                <div>
                  <h2 style="margin:0 0 6px">${esc(seller.displayName)}</h2>
                  <p style="margin:0">${esc(seller.email)}</p>
                </div>
                <div class="row">
                  <a class="btn alt" href="/sellers/${encodeURIComponent(seller.id)}">View seller</a>
                  <form method="post" action="/sellers/${encodeURIComponent(seller.id)}/delete" onsubmit="return confirm('Delete this seller from the demo store?');">
                    <button class="btn alt" type="submit">Delete seller</button>
                  </form>
                </div>
              </div>
              <div class="meta">
                <div class="tile"><span class="k">Seller ID</span><span class="v">${esc(seller.id)}</span></div>
                <div class="tile"><span class="k">Connected Account</span><span class="v">${esc(seller.stripeAccountId)}</span></div>
                <div class="tile"><span class="k">Requirements</span><span class="v">${esc(seller.requirementsStatus)}</span></div>
                <div class="tile"><span class="k">Transfers</span><span class="v">${esc(seller.stripeTransfersStatus)}</span></div>
              </div>
              <div class="row" style="margin-top:14px">
                <span class="pill ${seller.readyToReceivePayments ? "ok" : "warn"}">Ready: ${seller.readyToReceivePayments ? "Yes" : "No"}</span>
                <span class="pill ${seller.onboardingComplete ? "ok" : "warn"}">Onboarding: ${seller.onboardingComplete ? "Complete" : "Not complete"}</span>
              </div>
              ${seller.liveStatusError ? `<p class="error">Stripe status error: ${esc(seller.liveStatusError)}</p>` : ""}
            </section>
          `)
          .join("")
      : `<div class="empty">No sellers yet. Create one below.</div>`;

    const body = `
      ${
        hasDeleteResult
          ? `<section class="card" style="margin-bottom:16px"><div class="row" style="justify-content:space-between;align-items:center"><h2 style="margin:0">Delete result</h2><span class="pill ${deleteResultState}">${esc(deleteResultLabel)}</span></div><p style="margin:10px 0 0">${esc(notice)}</p></section>`
          : ""
      }
      <div class="grid two">
        <section class="card">
          <h2 style="margin-top:0">Create connected seller</h2>
          <p>This creates an Accounts v2 connected account using the exact V2 recipient structure required by the prompt. The only local record is sellerId -> account.id in memory.</p>
          <form method="post" action="/sellers">
            <label>Display name<input name="displayName" placeholder="North Quarter Cafe" required /></label>
            <label>Contact email<input name="email" type="email" placeholder="owner@example.com" required /></label>
            <button type="submit">Create connected account</button>
          </form>
        </section>
        <section class="card">
          <h2 style="margin-top:0">Webhook activity</h2>
          <p>Recent thin-event deliveries show up here.</p>
          ${store.webhookLog.length ? `<pre>${esc(store.webhookLog.join("\n"))}</pre>` : `<div class="empty">No webhook events received yet.</div>`}
        </section>
      </div>
      <div class="stack" style="margin-top:16px">${cards}</div>
    `;

    res.send(view({
      active: "/sellers",
      title: "Connected Sellers",
      subtitle: "Create sellers, inspect live onboarding status, and start Express onboarding with Account Links v2.",
      notice: hasDeleteResult ? "" : notice ? esc(notice) : "",
      body,
    }));
  } catch (error) {
    next(error);
  }
});

app.post("/sellers", async (req, res, next) => {
  try {
    const displayName = String(req.body.displayName || "").trim();
    const email = String(req.body.email || "").trim();
    if (!displayName || !email) {
      const error = new Error("Display name and contact email are required.");
      error.statusCode = 400;
      throw error;
    }

    // This is the exact Accounts v2 payload requested. No top-level type is passed.
    const account = await stripeClient.v2.core.accounts.create({
      display_name: displayName,
      contact_email: email,
      identity: { country: "gb" },
      dashboard: "express",
      defaults: {
        responsibilities: {
          fees_collector: "application",
          losses_collector: "application",
        },
      },
      configuration: {
  merchant: {
    capabilities: {
      card_payments: { requested: true },
    },
  },
  recipient: {
    capabilities: {
      stripe_balance: {
        stripe_transfers: { requested: true },
      },
    },
  },
},
   });

    const seller = {
      id: sellerId(),
      displayName,
      email,
      stripeAccountId: account.id,
      createdAt: new Date().toISOString(),
    };
    store.sellers.set(seller.id, seller);
    flash(res, `/sellers/${encodeURIComponent(seller.id)}`, "Connected account created. Use onboarding next.");
  } catch (error) {
    next(error);
  }
});
app.get("/sellers/:sellerId", async (req, res, next) => {
  try {
    const seller = mustSeller(req.params.sellerId);
    const live = await liveSellerStatus(seller);

    const body = `
      <section class="card">
        <h2 style="margin-top:0">${esc(live.displayName)}</h2>
        <p>This page reads the connected account status from Stripe every time it loads. Nothing here is cached except the seller-to-account mapping.</p>
        <div class="meta">
          <div class="tile"><span class="k">Seller ID</span><span class="v">${esc(live.id)}</span></div>
          <div class="tile"><span class="k">Connected Account</span><span class="v">${esc(live.stripeAccountId)}</span></div>
          <div class="tile"><span class="k">Requirements</span><span class="v">${esc(live.requirementsStatus)}</span></div>
          <div class="tile"><span class="k">Transfers</span><span class="v">${esc(live.stripeTransfersStatus)}</span></div>
        </div>
        <div class="row" style="margin-top:14px">
          <span class="pill ${live.readyToReceivePayments ? "ok" : "warn"}">Ready: ${live.readyToReceivePayments ? "Yes" : "No"}</span>
          <span class="pill ${live.onboardingComplete ? "ok" : "warn"}">Onboarding: ${live.onboardingComplete ? "Complete" : "Not complete"}</span>
        </div>
        <div class="row" style="margin-top:16px">
          <form method="post" action="/sellers/${encodeURIComponent(live.id)}/onboard">
            <button type="submit">Onboard to collect payments</button>
          </form>
          <form method="post" action="/sellers/${encodeURIComponent(live.id)}/delete" onsubmit="return confirm('Delete this seller from the demo store?');">
            <button class="btn alt" type="submit">Delete seller</button>
          </form>
          <a class="btn alt" href="/products/new">Create a platform product</a>
          <a class="btn alt" href="/sellers">Back to sellers</a>
        </div>
      </section>
    `;

    res.send(view({
      active: "/sellers",
      title: "Seller Detail",
      subtitle: "Generate a fresh Account Links v2 URL for this connected account whenever the seller needs onboarding or remediation.",
      notice: req.query.notice ? esc(req.query.notice) : "",
      body,
    }));
  } catch (error) {
    next(error);
  }
});

app.post("/sellers/:sellerId/onboard", async (req, res, next) => {
  try {
    const seller = mustSeller(req.params.sellerId);

    // Account Links v2 starts the hosted Express onboarding flow for the recipient configuration.
    const link = await stripeClient.v2.core.accountLinks.create({
      account: seller.stripeAccountId,
      use_case: {
        type: "account_onboarding",
        account_onboarding: {
          configurations: ["merchant", "recipient"],          refresh_url: `${BASE_URL}/sellers/${seller.id}`,
          return_url: `${BASE_URL}/sellers/${seller.id}`,
        },
      },
    });

    res.redirect(303, link.url);
  } catch (error) {
    next(error);
  }
});

app.post("/sellers/:sellerId/delete", async (req, res, next) => {
  try {
    const seller = mustSeller(req.params.sellerId);

    let stripeDeleteNote = "";
    try {
      stripeDeleteNote = await bestEffortDeleteStripeAccount(seller.stripeAccountId);
    } catch (stripeError) {
      stripeDeleteNote = `Stripe account cleanup skipped: ${stripeError.message}`;
    }

    store.sellers.delete(seller.id);
    flash(res, "/sellers", `Seller ${seller.displayName} deleted from demo store. ${stripeDeleteNote}`);
  } catch (error) {
    next(error);
  }
});

app.get("/products/new", (req, res) => {
  const sellers = allSellers();
  const options = sellers
    .map(
      (seller) =>
        `<option value="${esc(seller.stripeAccountId)}">${esc(`${seller.displayName} (${seller.stripeAccountId})`)}</option>`
    )
    .join("");

  const body = `
    <div class="grid two">
      <section class="card">
        <h2 style="margin-top:0">Create platform product</h2>
        <p>This creates the product on the platform account only. The connected account mapping is stored in product metadata.</p>
        ${
          sellers.length
            ? `
              <form method="post" action="/products">
                <label>Product name<input name="name" placeholder="Chef's tasting menu" required /></label>
                <label>Description<textarea name="description" placeholder="Premium hosted dining experience."></textarea></label>
                <label>Price (minor units)<input name="unitAmount" type="number" min="50" step="1" placeholder="2500" required /></label>
                <label>Currency<input name="currency" value="usd" maxlength="3" required /></label>
                <label>Connected account<select name="connectedAccountId" required>${options}</select></label>
                <button type="submit">Create product</button>
              </form>
            `
            : `<div class="empty">Create a seller first so there is a connected account to attach to the product.</div>`
        }
      </section>
      <section class="card">
        <h2 style="margin-top:0">Stripe notes</h2>
        <p>Checkout uses hosted Checkout, destination charges, and a 5% application fee. The server validates connected account metadata before it attempts to create a session.</p>
        <div class="meta">
          <div class="tile"><span class="k">Base URL</span><span class="v">${esc(BASE_URL)}</span></div>
          <div class="tile"><span class="k">Webhook Secret</span><span class="v">${STRIPE_WEBHOOK_SECRET ? "Configured" : "Not configured"}</span></div>
        </div>
      </section>
    </div>
  `;

  res.send(view({
    active: "/products/new",
    title: "Create a Platform Product",
    subtitle: "Products stay on the platform account. Metadata tells checkout which connected account should receive funds.",
    notice: req.query.notice ? esc(req.query.notice) : "",
    body,
  }));
});

app.post("/products", async (req, res, next) => {
  try {
    const name = String(req.body.name || "").trim();
    const description = String(req.body.description || "").trim();
    const unitAmount = Number(req.body.unitAmount);
    const currency = String(req.body.currency || "").trim().toLowerCase();
    const connectedAccountId = String(req.body.connectedAccountId || "").trim();

    if (!name) {
      const error = new Error("Product name is required.");
      error.statusCode = 400;
      throw error;
    }
    if (!connectedAccountId) {
      const error = new Error("A connected account is required.");
      error.statusCode = 400;
      throw error;
    }
    if (!Number.isInteger(unitAmount) || unitAmount <= 0) {
      const error = new Error("Price must be a positive integer in minor units.");
      error.statusCode = 400;
      throw error;
    }
    if (!currency || currency.length !== 3) {
      const error = new Error("Currency must be a three-letter ISO code such as usd.");
      error.statusCode = 400;
      throw error;
    }

    // Products are created on the platform account. Metadata stores the seller mapping.
    await stripeClient.products.create({
      name,
      description,
      default_price_data: {
        unit_amount: unitAmount,
        currency,
      },
      metadata: {
        connected_account_id: connectedAccountId,
        unit_amount_cents: String(unitAmount),
        currency,
      },
    });

    flash(res, "/", "Product created. It is now available in the storefront.");
  } catch (error) {
    next(error);
  }
});
app.post("/checkout/:productId", async (req, res, next) => {
  try {
    const product = await storefrontProduct(req.params.productId);
    const applicationFeeAmount = Math.max(1, Math.round(product.unitAmount * 0.05));

    // Hosted Checkout keeps card handling inside Stripe while destination charges
    // send the funds to the connected account and keep the app fee on the platform.
    const session = await stripeClient.checkout.sessions.create({
      line_items: [
        {
          price_data: {
            currency: product.currency,
            unit_amount: product.unitAmount,
            product_data: {
              name: product.name,
              description: product.description,
            },
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        application_fee_amount: applicationFeeAmount,
        transfer_data: {
          destination: product.connectedAccountId,
        },
      },
      mode: "payment",
      success_url: `${BASE_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${BASE_URL}/`,
    });

    res.redirect(303, session.url);
  } catch (error) {
    next(error);
  }
});

app.get("/success", async (req, res, next) => {
  try {
    const sessionId = String(req.query.session_id || "").trim();
    let session = null;
    if (sessionId) {
      session = await stripeClient.checkout.sessions.retrieve(sessionId);
    }

    const body = `
      <section class="card">
        <h2 style="margin-top:0">Checkout complete</h2>
        <p>The hosted Checkout flow returns here after payment. This page fetches the Checkout Session so the operator can confirm the reference.</p>
        <div class="meta">
          <div class="tile"><span class="k">Session ID</span><span class="v">${esc(sessionId || "Unavailable")}</span></div>
          <div class="tile"><span class="k">Payment Status</span><span class="v">${esc(session?.payment_status || "Unavailable")}</span></div>
          <div class="tile"><span class="k">Customer Email</span><span class="v">${esc(session?.customer_details?.email || "Unavailable")}</span></div>
        </div>
        <div class="row" style="margin-top:16px">
          <a class="btn" href="/">Back to storefront</a>
          <a class="btn alt" href="/sellers">View sellers</a>
        </div>
      </section>
    `;

    res.send(view({
      active: "/",
      title: "Success",
      subtitle: "This is the success URL used by Checkout Sessions in the demo.",
      body,
    }));
  } catch (error) {
    next(error);
  }
});

app.use((error, req, res, next) => {
  const statusCode = Number(error.statusCode) || 500;
  const title = statusCode >= 500 ? "Server Error" : "Request Error";
  res.status(statusCode).send(view({
    active: "",
    title,
    subtitle: "The demo returns clear setup errors so missing env vars or Stripe metadata problems are obvious.",
    body: `
      <section class="card">
        <h2 style="margin-top:0">${esc(title)}</h2>
        <p>${esc(error.message || "Unknown error")}</p>
        <div class="row">
          <a class="btn alt" href="/">Back to storefront</a>
          <a class="btn alt" href="/sellers">Open sellers</a>
        </div>
      </section>
    `,
  }));
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Stripe Connect demo listening at ${BASE_URL} on port ${PORT}`);
  });
}

module.exports = { app, stripeClient, store };
