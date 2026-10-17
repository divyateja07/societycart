# Launching and viewing SocietyCart

## In the published Codex cloud environment

The existing source files, compiled assets, dependency caches, and Docker images are retained. Start the application without rebuilding:

```bash
cd /workspace/societycart
./scripts/start-cloud.sh
```

The script preserves `.env`, starts the existing Docker images, waits for PostgreSQL/backend health, and checks frontend HTTP. It does not regenerate the project or rebuild its images.

The cloud onboarding interface does not provide a public browser preview or a port-forwarding URL. Its loopback ports are internal to the cloud machine. Opening localhost on your own computer will not connect to that machine. Screenshots are available in `docs/screenshots/`.

## View it in a browser on your computer

Install Git and Docker Desktop (or Docker Engine with Compose on Linux). With Docker running, open a terminal:

```bash
git clone --branch feature/societycart-mvp https://github.com/divyateja07/societycart.git
cd societycart
./scripts/bootstrap-local.sh
docker compose up --build -d
```

The first launch on a new computer builds container images from the existing project source. It does not recreate the application. Later launches can use `docker compose up -d` with the retained images.

Wait for the backend health check:

```bash
docker compose ps
docker compose logs --tail=50 backend
```

In a browser **on that same computer**, enter `http://localhost:5173`. Backend health is at `http://localhost:8080/actuator/health`; API documentation is at `http://localhost:8080/swagger-ui/index.html`.

After the feature branch is merged, a normal clone of `main` will also contain the application.

## Try the buying workflow

1. Register a customer account, choose Green Valley Apartments, enter a flat number, and request membership.
2. In another browser profile or private window, sign in with the local administrator email and password stored in your own ignored `.env`. The bootstrap script generates a unique administrator password; never share that file or commit it.
3. Approve the customer's membership in the admin area.
4. Return to the customer session, shop the active buying cycle, add groceries, and confirm the order.
5. Choose **Simulate successful payment**. No real money is collected.
6. Add further household orders or create a new cycle with a smaller minimum to demonstrate a successful collective. The seeded minimum is ₹20,000.
7. In Admin → Buying cycles, close the cycle and inspect its supplier summary. Advance fulfillment in Admin → Orders; the resident can see the updated tracking state.

All demo price references are illustrative. Razorpay checkout and webhook processing are disabled and incomplete. See README.md for the full feature boundaries.

To stop local services while preserving the database:

```bash
docker compose stop
```

Do not run `docker compose down -v` unless you intend to permanently delete the local database volume.
