# Polar Payment Integration

## Environment (`backend/.env`)

```env
POLAR_API_KEY=your_sandbox_access_token
POLAR_WEBHOOK_SECRET=whsec_...
POLAR_ENVIRONMENT=sandbox
POLAR_AI_SUBSCRIPTION_PRODUCT_ID=uuid-from-polar-sandbox
POLAR_APPOINTMENT_PRODUCT_ID=uuid-from-polar-sandbox
FRONTEND_URL=http://localhost:3000
AI_SUBSCRIPTION_AMOUNT_PKR=2000
AI_SUBSCRIPTION_DAYS=30
```

Never commit real keys. Frontend never receives secrets.

## Polar Sandbox Setup

1. Create account at [polar.sh](https://polar.sh) and switch to **Sandbox**
2. Create products:
   - **AI Doctor Plan** — recurring/monthly, PKR 2000 (or custom price)
   - **Appointment Consultation** — one-time with custom/ad-hoc pricing
3. Copy product UUIDs into `.env`
4. Create Organization Access Token → `POLAR_API_KEY`
5. Add webhook endpoint: `https://your-domain/api/v1/payments/webhooks/polar`
   - Events: `checkout.updated`, `order.paid`
   - Copy signing secret → `POLAR_WEBHOOK_SECRET`
6. For local dev use [Polar CLI](https://polar.sh/docs/integrate/webhooks/locally) or ngrok

## Migration

```bash
cd backend
python -m app.db.migrate_payments
```

## Business Rules

| Feature | Rule |
|---------|------|
| AI Doctor | Requires active subscription (30 days) |
| Appointments | Payment before booking; slot reserved only after webhook/verify |
| Subscription | PKR 2000/month, auto-expires after 30 days |

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /payments/subscription/status` | Current subscription |
| `POST /payments/checkout/subscription` | Start AI plan checkout |
| `POST /payments/checkout/appointment` | Start appointment payment |
| `GET /payments/verify/{checkout_id}` | Backend payment verification |
| `GET /payments/history` | Patient payment history |
| `POST /payments/webhooks/polar` | Polar webhook (signature verified) |

## Frontend Pages

- `/patient/billing/plans` — Subscribe
- `/patient/billing/success` — Post-payment verification
- `/patient/billing/failed` — Failed payment
- `/patient/billing/history` — Transaction history
