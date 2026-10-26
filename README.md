# Subscription Billing App

A subscription management backend with an admin dashboard, built with Node.js, Express and TypeScript. Customers sign up, subscribe to a plan, and an admin tracks customers, plans and transactions from a responsive dashboard.

> **Status:** Core API, validation, admin security, dashboard and automated tests are complete. Payments are currently **simulated** through a development endpoint. Paystack test-mode integration and webhooks are the next milestone.

## Features

- REST API for plans, customers, subscriptions and transactions
- Input validation with Zod and clear error responses
- Admin dashboard (HTML, CSS, JavaScript) with light and dark themes, built mobile-first
- Admin routes protected by an API key
- Idempotent payment confirmation: the same payment can never be applied twice
- Automated tests using Node's built-in test runner and an in-memory database

## Tech stack

TypeScript, Node.js, Express, SQLite (`node:sqlite`), Zod, Helmet, express-rate-limit, vanilla HTML/CSS/JS frontend.

## Getting started

Requires **Node.js 22.5 or newer** (for the built-in SQLite module).

```bash
git clone <your-repo-url>
cd subscription-app
npm install
cp .env.example .env
```

Open `.env` and set a long random `ADMIN_KEY`. You can generate one with:

```bash
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

Start the server:

```bash
npm run dev
```

Open `http://localhost:3000` for the dashboard. It asks for the admin key on first load.

## Running the tests

```bash
npm test
```

Tests run against a throwaway in-memory database, so your real data is never touched.

## API overview

| Method | Route | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/health` | Public | Health check |
| GET | `/api/plans` | Public | List plans |
| POST | `/api/customers` | Public | Create a customer |
| POST | `/api/subscriptions` | Public | Subscribe a customer to a plan (creates a pending transaction) |
| GET | `/api/customers` | Admin | List customers |
| GET | `/api/admin/stats` | Admin | Revenue and subscription totals |
| GET | `/api/admin/transactions` | Admin | List transactions |
| POST | `/api/dev/simulate-payment/:reference` | Admin, non-production | Stand-in for a payment provider webhook |

Admin routes require an `x-admin-key` header.

Example:

```bash
curl -X POST localhost:3000/api/customers \
  -H "Content-Type: application/json" \
  -d '{"name":"Ada","email":"ada@test.com"}'
```

## Design decisions

- **Money is stored in kobo** (integers), matching how Paystack works and avoiding decimal rounding bugs.
- **Parameterised SQL queries** prevent SQL injection.
- **Validation happens before the database** and rejects bad input with field-level messages.
- **Internal errors are never exposed** to clients. They are logged server-side and users see a generic message.
- **Admin key comparison is constant-time** (`timingSafeEqual`), so response timing can't be used to guess it.
- **Payment confirmation is idempotent.** Payment providers can send the same webhook more than once, so confirming an already-paid transaction is safely ignored.
- **Security basics:** Helmet headers, request size limits and rate limiting on the API.
- **Secrets stay out of Git.** `.env` and the database file are ignored.

## Project structure

```
src/
  app.ts            Express app and public routes
  server.ts         Starts the server
  db.ts             SQLite schema and seed plans
  middleware.ts     Validation, admin guard, error handling
  schemas.ts        Zod schemas
  subscriptions.ts  Subscription and payment confirmation logic
  routes.ts         Subscription and admin routes
public/             Admin dashboard (HTML, CSS, JS)
test/               Automated API tests
```

## Roadmap

- [ ] Paystack test-mode checkout (initialise and verify transactions)
- [ ] Paystack webhook endpoint with signature verification to update subscription status
- [ ] Replace the simulated payment endpoint with the real webhook flow
- [ ] Tests for the webhook flow