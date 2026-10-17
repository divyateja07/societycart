# SocietyCart — Buy Together. Save Together.

A runnable demonstration of society grocery buying, with React/TypeScript, Spring Boot 3.5 / Java 21, and PostgreSQL 16. **This is a development MVP, not a production release.** The complete implemented customer flow is registration → approved membership → active collective → cart → server-priced checkout → simulated payment → orders. Admins approve memberships, create cycles, close them transactionally, inspect procurement, and advance fulfillment.

For step-by-step browser launch instructions, see [docs/launch.md](docs/launch.md).

## Start locally

Prerequisites: Docker Engine with Compose. For frontend development: Node 24. For backend development: a full Java 21 JDK and Maven 3.9+.

```bash
./scripts/bootstrap-local.sh
# Review .env locally. Unique passwords are generated; never commit this file.
docker compose up --build -d
```

Frontend: `http://localhost:5173`, backend: `http://localhost:8080`, health: `/actuator/health`, Swagger: `http://localhost:8080/swagger-ui/index.html`. The frontend container proxies API requests on the same origin. Do not expose this demo to the public internet.

For Vite hot reload, stop the Compose frontend first (both use port 5173):

```bash
docker compose stop frontend
cd frontend
npm ci
npm run dev
```

For backend hot development, stop the Compose backend, keep PostgreSQL running, export the database connection variables from your local configuration, and run `mvn spring-boot:run` from `backend/`. On this cloud machine use `scripts/maven.sh spring-boot:run` from the repository root; the helper selects the installed JDK, writable Maven cache, and platform network proxy. Set `SOCIETYCART_JAVA_HOME` if Java is elsewhere. Cloud provisioning can be reproduced with `scripts/setup-cloud.sh` and service startup with `scripts/start-cloud.sh`. No separate Git worktree is needed; each cloud task is already isolated.

## Demo accounts and data

`bootstrap-local.sh` creates an ignored, mode-0600 `.env` with a unique admin password and `admin@example.test` as the local admin email. Read your own `.env` locally to sign in; no public admin registration exists. Admin bootstrap runs only with `DEMO_MODE=true`, requires a 12-character password, and never changes an existing account's password or role.

Register a customer through the UI; request Green Valley Apartments with a flat number. In another browser/session, sign in as the admin and approve it. Seed data includes three Pune societies, nine categories, ten groceries, one supplier, and a seven-day buying cycle. **All seed prices and references are illustrative, not market quotes.** Seed insertion runs only when demo mode is enabled and the societies table is empty.

For a quick successful collective, create a new cycle with a low minimum using the admin form. The seeded minimum is ₹20,000. The admin may close a cycle early; closure is explicit and there is no background scheduler. A successful cycle generates consolidated supplier orders; a failed one refunds paid orders in simulation. Pending orders are cancelled and stock is restored at closure.

## Browser verification and screenshots

With Compose running and the generated `.env` available:

```bash
# On this cloud machine Chromium is already installed.
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium node scripts/browser-smoke.mjs
# On other machines install Chromium with: cd frontend && npx playwright install chromium
# Then run node scripts/browser-smoke.mjs from the repository root.
```

This creates uniquely named demo households, a buying cycle, paid simulated orders, procurement and fulfillment records. It does not delete existing data. The test checks two-household aggregation, administrator fulfillment, logout/login, runtime errors, and mobile overflow. Screenshots are saved under `docs/screenshots/`.

## Tests

For the running Compose database, `./scripts/test-compose.sh` creates a separate `societycart_test` database and runs the backend tests, frontend tests and production frontend build using your existing local database binding. It never prints credentials.


Use a **disposable** PostgreSQL database. Integration tests create uniquely named records and do not clean or truncate user databases.

```bash
export DATABASE_URL=jdbc:postgresql://localhost:5432/societycart_test
export DATABASE_USER=societycart
# Supply DATABASE_PASSWORD securely in your environment.
DEMO_MODE=true ./scripts/maven.sh test
npm --prefix frontend ci
npm --prefix frontend test
npm --prefix frontend run build
```

The tests cover password hashing, authentication, authorization, CSRF, membership gating/rejection, authoritative prices, idempotency, stock races, duplicate simulated payments, expired cycles, aggregation, fulfillment transitions, failed volume refunds, failed payments, and customer order isolation. Frontend tests use Vitest and Testing Library for login, membership, cart, checkout, protected admin content, and tracking.

## Important boundaries

- Payments are simulated, visibly labeled, and require `DEMO_MODE=true`. Never enable demo mode in production.
- A Razorpay HTTP/HMAC adapter exists with signature tests. It is **not wired into checkout**. Selecting `PAYMENT_PROVIDER=razorpay` fails closed. Webhook event persistence, duplicate event handling, refund reconciliation, and sandbox end-to-end validation remain required before enabling it. No real or sandbox payment was made.
- Order inventory is reserved at checkout. Unpaid reservations are released on failed payment or explicit cycle closure; automatic expiration is not implemented.
- Supplier/product price snapshots exist, but quotation history, a supplier portal, image uploads, category editing UI, and production financial accounting are not complete. Supplier editing, current quotations, profile name editing, and society/cycle/product analytics are available.
- Admin cycle creation UI handles one product per cycle; the REST endpoint supports multiple prices. Catalog and order lists are capped at 100 rows; cursor/page-based APIs remain work for scale.
- Sessions use the local servlet session store; rate limiting is in-memory per remote IP. Use shared stores and trusted proxy configuration before scaling.
- No email verification, password reset, OTP, delivery routing, notifications, or production deployment has been implemented.

See [architecture](docs/architecture.md), [API reference](docs/api.md), and [deployment guide](docs/deployment.md). Validation results are recorded in [docs/validation.md](docs/validation.md).
