# Architecture

```mermaid
flowchart LR
  Resident[Resident browser] --> UI[React + Vite / Nginx]
  Admin[Administrator browser] --> UI
  UI -->|same-origin API + session cookie + CSRF| API[Spring Boot / Spring Security]
  API -->|transactional JDBC / Flyway schema| DB[(PostgreSQL 16)]
  API --> Demo[Demo-only payment service]
  Adapter[Razorpay adapter: not activated] -.-> Gateway[Razorpay HTTPS API]
```

The backend is one application, not microservices. Account lookup uses a Spring Data JPA entity/repository; commerce operations use parameterized `JdbcTemplate` SQL so locking and procurement aggregation remain explicit. `Api` currently groups the vertical workflows and should be split into feature controllers/services before substantial expansion. DTO records and Bean Validation validate requests; `Errors` returns safe client messages.

Money is stored in bigint paise. Checkout ignores frontend totals and snapshots reference, group, and supplier cost per item. Stock is reserved transactionally. Checkout, payment, closure, and cancellation all lock the cycle first, serializing stock and cycle transitions. A per-user unique order key prevents duplicate orders on retry; reuse with different cycle, method, or item quantities returns 409. Payments are unique per order. Repeating a finalized simulated payment returns the existing result. Closing a finalized cycle returns its existing state without duplicate supplier orders/refunds.

## State machines

```mermaid
stateDiagram-v2
  [*] --> OPEN: Admin creates cycle
  OPEN --> SUCCESS: Explicit close / paid total meets minimum
  OPEN --> FAILED: Explicit close / paid total below minimum
```

```mermaid
stateDiagram-v2
  [*] --> PAYMENT_PENDING: Checkout and reserve stock
  PAYMENT_PENDING --> PAID: Server simulation confirmation
  PAYMENT_PENDING --> CANCELLED: Failed payment or closed cycle
  PAID --> REFUNDED: Failed collective or open-cycle cancellation
  PAID --> PROCESSING: Successful collective
  PROCESSING --> SUPPLIER_CONFIRMED
  SUPPLIER_CONFIRMED --> PACKED
  PACKED --> READY_FOR_COLLECTION
  READY_FOR_COLLECTION --> DELIVERED
```

Order payment state and fulfillment state are separate. Delivery orders use `OUT_FOR_DELIVERY` before `DELIVERED`; collection orders use `READY_FOR_COLLECTION`. Failed cycles simulate refunds; no bank transfers occur.

## Entity relationships

```mermaid
erDiagram
 users ||--o{ society_memberships : requests
 societies ||--o{ society_memberships : approves
 societies ||--o{ buying_cycles : hosts
 categories ||--o{ products : categorizes
 suppliers ||--o{ supplier_products : quotes
 products ||--o{ supplier_products : sourced
 buying_cycles ||--o{ cycle_product_prices : offers
 products ||--o{ cycle_product_prices : priced
 suppliers ||--o{ cycle_product_prices : supplies
 users ||--o{ orders : places
 buying_cycles ||--o{ orders : aggregates
 orders ||--|{ order_items : snapshots
 products ||--o{ order_items : purchased
 suppliers ||--o{ order_items : fulfills
 orders ||--|| payments : requests
 payments ||--o| refunds : reverses
 orders ||--o| fulfillments : tracks
 buying_cycles ||--o{ supplier_orders : procures
 suppliers ||--o{ supplier_orders : receives
 supplier_orders ||--|{ supplier_order_items : consolidates
 products ||--o{ supplier_order_items : ordered
 users ||--o{ audit_logs : acts
```

UUID keys, referential constraints, unique keys, nonnegative price/stock checks, and query indexes are created by Flyway. Flyway owns DDL; Hibernate never modifies it. A second migration adds consistent creation/update timestamps and update triggers across all 17 application tables.
