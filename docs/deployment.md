# Deployment and configuration

## Environment reference

| Variable | Purpose |
|---|---|
| DATABASE_URL | JDBC PostgreSQL URL; default localhost:5432/societycart |
| DATABASE_USER | PostgreSQL user, default societycart |
| DATABASE_PASSWORD | Required database credential; never checked into Git |
| DEMO_MODE | Enables seed/admin bootstrap and simulated payments; default false |
| ADMIN_EMAIL | Optional local demo administrator bootstrap email |
| ADMIN_PASSWORD | Optional local demo administrator password, at least 12 characters |
| PAYMENT_PROVIDER | simulated only; razorpay selection intentionally fails closed |
| LOGGING_STRUCTURED_FORMAT_CONSOLE | Compose sets ecs for structured JSON logs |
| COOKIE_SECURE | true requires HTTPS; false for local HTTP only |
| SOCIETYCART_JAVA_HOME | Cloud helper full JDK path override |
| MAVEN_CMD | Cloud helper Maven executable override |
| SOCIETYCART_CACHE | Writable dependency cache, default /workspace/.cache |

`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET` are future integration requirements; the adapter constructor accepts these through an eventual configuration binding, and the current application does not consume them. Do not add credentials until the lifecycle integration is complete.

## Production release checklist

This repository is intentionally blocked from operating as a production payment service. Before releasing:

- Finish and sandbox-test gateway creation, captured-payment verification, raw-body webhook handling, event deduplication, reconciliation, and refund lifecycle handling.
- Disable demo data, admin bootstrap, and all simulation endpoints; provision administrators through a controlled operational mechanism.
- Terminate TLS at a trusted reverse proxy; set secure cookies; enforce HTTPS, CSP and trusted forwarding rules; keep database and backend private.
- Use managed PostgreSQL with encrypted backups and tested restoration, least-privilege application credentials, and migration ownership separation.
- Add shared session and rate-limit stores, password reset/verification, session expiry policies, security monitoring, and privacy controls.
- Add structured request/event logs, trace IDs, metrics, alerts, graceful shutdown, readiness monitoring and operational runbooks. The Compose backend already has an HTTP health probe.
- Add automated closure and reservation expiry, operational cancellation policies after procurement, refund reconciliation and fulfillment exception handling.
- Add pagination, administrative validation/audit coverage, shipping and tax rules, supplier quotation history, and accurate financial accounting. Current product margin is an estimate excluding logistics and overhead.
- Run dependency/security scans, browser accessibility checks, backup/restore exercises, load/concurrency tests, and penetration testing.

## Troubleshooting

Database connection refused: check `docker compose ps` and the PostgreSQL health check. A changed password in `.env` does not change credentials in an existing database volume; rotate using PostgreSQL, or use a new disposable database for development. Never delete a volume containing needed data.

403 on writes: fetch `/api/v1/auth/csrf`, retain the session cookie, and send the returned header/token. Browsers should call the same frontend origin; no broad CORS policy is enabled.

No groceries: customers need approved membership and an open cycle whose start is past and cutoff is future. Seeds are not refreshed on every restart.

Maven cannot resolve dependencies in cloud: use `scripts/maven.sh`, which derives the supported proxy route without printing credentials. TLS verification remains enabled. A Java runtime alone is insufficient: a full JDK is required.
