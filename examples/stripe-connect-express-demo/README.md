# Stripe Connect Express Demo

## Run

```bash
copy examples\\stripe-connect-express-demo\\.env.example examples\\stripe-connect-express-demo\\.env
npm run demo:stripe:express
```

Open:

```text
http://localhost:3001
```

## Thin webhook listener

```bash
stripe listen --thin-events "v2.core.account[requirements].updated,v2.core.account[configuration.recipient].capability_status_updated" --forward-to http://localhost:3001/webhooks/stripe
```

The server also accepts `v2.core.account[recipient].capability_status_updated` in case your Stripe account emits that name.
