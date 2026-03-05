# Vercel Production Env Template

Use this as the clean source for your Vercel Production environment variables.

Do not paste `VERCEL_*`, `VERCEL_GIT_*`, or `VERCEL_OIDC_TOKEN` values into your permanent project env settings. Vercel provides those automatically at runtime.

```dotenv
DATABASE_URL="postgresql://<USER>:<PASSWORD>@<HOST>:5432/<DB_NAME>?sslmode=require"

DEFAULT_RESTAURANT_SLUG="<your-live-restaurant-slug>"

WAITER_PASSCODES="<4-digit-code>[,<4-digit-code>...]"
BAR_PASSCODES="<4-digit-code>[,<4-digit-code>...]"
KITCHEN_PASSCODES="<4-digit-code>[,<4-digit-code>...]"
MANAGER_PASSCODES="<4-digit-code>[,<4-digit-code>...]"
ADMIN_PASSCODES="<4-digit-code>[,<4-digit-code>...]"

SYSTEM_AUTH_SECRET="<long-random-secret-at-least-24-chars>"
STAFF_SESSION_SECRET="<different-long-random-secret-at-least-24-chars>"

PAYMENT_MODE="EXTERNAL"
PAYMENT_PROVIDER="STRIPE_CONNECT"
PAYMENT_PROVIDER_SECRET="<your-stripe-secret-key-or-provider-secret>"
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="<your-stripe-publishable-key>"
STRIPE_CONNECT_CLIENT_ID="<your-stripe-connect-client-id>"
STRIPE_CONNECT_OAUTH_REDIRECT_URI="https://<your-domain>/api/stripe/connect/callback"
STRIPE_WEBHOOK_SECRET="<your-stripe-webhook-secret>"
STRIPE_PLATFORM_SUBSCRIPTION_PRICE_ID="<your-stripe-price-id>"

ENABLE_NAMED_STAFF_ACCOUNTS="true"
ENABLE_SETUP_V2="true"
ENABLE_DURABLE_RUNTIME_REQUIRED="true"
ENABLE_EXTERNAL_PAYMENTS_REQUIRED="true"
ENABLE_DEMO_TOOLS="false"

NEXT_PUBLIC_SUPPORT_EMAIL="<support@yourdomain.com>"
NEXT_PUBLIC_SUPPORT_PHONE="<+44xxxxxxxxxx>"
NEXT_PUBLIC_SUPPORT_HOURS="Mon-Fri, 09:00-17:00 GMT"
NEXT_PUBLIC_SERVICE_REGION="United Kingdom"

NEXT_PUBLIC_MAINTENANCE_MODE="false"
NEXT_PUBLIC_CUSTOMER_MINIMAL_MODE="true"

NEXT_PUBLIC_BRAND_LOGO_URL=""
NEXT_PUBLIC_BRAND_HERO_URL=""
NEXT_PUBLIC_PLATFORM_NAME="NFC Ordering Platform"
NEXT_PUBLIC_PLATFORM_MONOGRAM="NP"

# Optional only if you use the isolated Stripe sample routes
STRIPE_SAMPLE_SECRET_KEY=""
STRIPE_SAMPLE_WEBHOOK_SECRET=""
```

## Remove From Your Current `.env.vercel.production`

Delete these lines if they are present:

- `STAFF_AUTH_SECRET`
- `NEXT_DIST_DIR`
- `NX_DAEMON`
- `TURBO_CACHE`
- `TURBO_DOWNLOAD_LOCAL_ENABLED`
- `TURBO_REMOTE_ONLY`
- `TURBO_RUN_SUMMARY`
- `VERCEL`
- `VERCEL_ENV`
- `VERCEL_TARGET_ENV`
- `VERCEL_URL`
- all `VERCEL_GIT_*`
- `VERCEL_OIDC_TOKEN`

## Quick Rules

- Every staff passcode must be a real 4-digit code and should not reuse the obvious defaults (`1111`, `1234`, etc.).
- `SYSTEM_AUTH_SECRET` and `STAFF_SESSION_SECRET` must be different values.
- Do not set `ALLOW_SIMULATED_PAYMENTS` in production.
- Keep `PAYMENT_MODE="EXTERNAL"` for live launch.
