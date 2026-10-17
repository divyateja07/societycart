# Validation evidence

The following checks were actually executed in this cloud instance. This establishes a working local demonstration, not production readiness or validation of a newly restored cloud task.

| Check | Result |
|---|---|
| Java 21 compilation and executable JAR packaging | Passed |
| JUnit / Spring Boot tests against real PostgreSQL 16 | 12 passed, 0 failed, 0 skipped |
| Vitest / React Testing Library | 10 passed, 0 failed |
| Strict TypeScript and Vite production build | Passed |
| Docker backend and frontend multi-stage builds | Passed |
| Docker Compose startup and backend/database health | Passed |
| Local backend health and frontend HTTP responses | UP / HTTP 200 |
| Flyway schema migration on a fresh Compose database | Both migrations applied |
| OpenAPI generation | Served successfully, 43 API paths |
| Chromium end-to-end workflow | Passed; successful run repeated |
| Desktop and 375px mobile layout | Screenshots captured; no home/catalog horizontal overflow |
| Browser uncaught runtime errors during successful workflow | None |
| npm production dependency audit | 0 known vulnerabilities reported |
| Shell setup/start/test helper syntax | Passed |

## What the browser exercised

A new resident registers and signs in, requests Green Valley Apartments with a flat number, and an administrator approves them through the admin UI. An administrator creates a cycle through its protected API with a two-basket minimum. The first resident adds groceries, checks out, and completes a clearly labeled simulated payment through the UI. A separate authenticated household registers, obtains membership approval, orders, and pays through the API. The combined paid value is asserted at ₹1,250 for two packs.

The administrator closes the cycle through the UI. The generated procurement summary is checked for exactly two packs. Fulfillment is advanced through supplier confirmation, packing, collection readiness, and delivery; the resident sees the delivered status. Analytics include the transactions. Logout and subsequent login succeed. Desktop/mobile screenshots are captured, and home/catalog overflow and browser runtime errors are checked.

JUnit additionally exercises rejected/unapproved membership, wrong role, missing CSRF, invalid credentials, BCrypt hashing, another account's order isolation, authoritative prices and savings, mismatched idempotency payloads, duplicate successful payment, failed payment and stock restoration, expired cycles, insufficient inventory, insufficient group volume and refunds, retry-safe closure, concurrent stock contention, and delivery-specific fulfillment states. HMAC signature tests verify a known vector and reject tampering/malformed signatures.

## Reproduce

```bash
./scripts/setup-cloud.sh
./scripts/start-cloud.sh
./scripts/test-compose.sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium node scripts/browser-smoke.mjs
```

The backend integration suite uses a separate `societycart_test` database. Browser tests deliberately create uniquely named demonstration data in the running demo database. Keep that database separate from real operational data.

## Limits

Razorpay sandbox/production requests, captured-payment reconciliation, duplicate webhooks, real refunds, real suppliers, external deployment, email/OTP, production load, comprehensive browser accessibility auditing, and Java dependency vulnerability scanning were not validated. A signature unit test is not evidence of gateway integration. See README.md and docs/deployment.md for remaining implementation work.

Cloud `install_script` and `start_skill` were saved as a configuration draft. Saving does not execute them, publish a snapshot, push source to GitHub, or establish that a fresh task restores correctly. Review and save the draft in environment settings, then publish the environment when satisfied with this demo.
