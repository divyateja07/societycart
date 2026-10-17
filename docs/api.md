# REST API

Base: `/api/v1`. OpenAPI is generated at `/v3/api-docs` and Swagger UI is at `/swagger-ui/index.html`. All commerce routes require session authentication. `/admin/**` additionally requires ADMIN. Responses are JSON objects or lists; errors use `message` and validation errors additionally include `fields`. Security-filter errors use Spring's standard error response.

For mutations first GET `/auth/csrf`, keep the session cookie, and send the returned `headerName` / `token` on subsequent writes. Login rotates the session ID. Use same-origin requests; cookies are HttpOnly with SameSite=Lax. TLS deployments must enable COOKIE_SECURE.

| Method | Route | Purpose |
|---|---|---|
| GET | /auth/csrf | Obtain CSRF token |
| POST | /auth/register | name, email, password; creates CUSTOMER only |
| POST | /auth/login | email, password; establishes session |
| POST | /auth/logout | invalidate session |
| GET | /auth/me | current account without password |
| GET | /societies?search= | active societies, max 100 |
| GET | /societies/{id} | active society details |
| POST | /memberships | societyId, flat; request membership |
| GET | /memberships/me | own approval statuses |
| GET | /categories | categories |
| GET | /products?search= | active products, max 100 |
| GET | /products/{id} | product details |
| GET | /cycles/active | open unexpired cycles for approved memberships |
| GET | /cycles/{id} | membership-restricted cycle and prices |
| GET | /cycles/{id}/progress | aggregate paid value, no personal data |
| POST | /orders | authoritative checkout; see example below |
| GET | /orders/me | own order/payment/refund/fulfillment history, max 100 |
| GET | /orders/{id} | own order with item snapshots |
| POST | /payments/create | orderId; inspect existing payment request |
| POST | /payments/simulate | orderId, success boolean; DEMO ONLY |
| GET | /admin/dashboard | backend-calculated counts, GMV, savings, margin |
| GET | /admin/memberships | memberships and resident details, max 100 |
| PATCH | /admin/memberships/{id} | status APPROVED or REJECTED |
| POST | /admin/societies | name, location, active |
| PATCH | /admin/societies/{id} | name, location, active |
| POST | /admin/products | categoryId, name, brand, packSize, image, active |
| PATCH | /admin/products/{id} | same fields as creation |
| GET / POST | /admin/suppliers | list / create with name, email |
| GET | /admin/cycles | all cycles, max 100 |
| POST | /admin/cycles | create cycle and fixed prices |
| POST | /admin/cycles/{id}/close | explicit transactional closure, safe retry |
| GET | /admin/cycles/{id}/summary | consolidated successful procurement |
| GET | /admin/orders?status= | orders with fulfillment IDs, max 100 |
| PATCH | /admin/fulfillments/{id} | next status in fulfillment state machine |
| POST | /admin/orders/{id}/refund | simulate open-cycle paid-order cancellation |

Checkout request (UUIDs are actual IDs obtained from the API):

```json
{"cycleId":"<cycle UUID>","idempotencyKey":"<unique checkout attempt>","method":"COLLECTION","items":[{"productId":"<product UUID>","quantity":2}]}
```

The response includes `id`, `total_paise`, `savings_paise`, `flat` and `status`. Retry the same checkout with the same key. Use a new key after changing basket contents. Reusing a key with different items, cycle, or fulfillment method returns HTTP 409.

Cycle creation:

```json
{"societyId":"<UUID>","name":"Weekly essentials","startsAt":"2026-10-17T00:00:00Z","cutoffAt":"2026-10-24T00:00:00Z","minimumPaise":2000000,"prices":[{"productId":"<UUID>","supplierId":"<UUID>","pricePaise":62500,"referencePaise":75000,"costPaise":56000,"stock":100,"referenceSource":"Illustrative demo price"}]}
```

Additional management routes: `PATCH /profile` (name), `GET /admin/societies`, `GET /admin/products` (including inactive records), `POST /admin/categories` (name), `PATCH /admin/categories/{id}` (name), `PATCH /admin/suppliers/{id}` (name/email/active), `GET /admin/suppliers/{id}/products`, `POST /admin/suppliers/{id}/products` (productId/costPaise), `GET /admin/cycles/{id}/demand`, `GET /admin/supplier-orders`, `PATCH /admin/supplier-orders/{id}` (status), and `GET /admin/analytics`.

No Razorpay webhook endpoint is exposed in this release. The unused adapter is documented as incomplete rather than accepting unverified gateway events.
