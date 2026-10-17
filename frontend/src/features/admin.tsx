import { useState } from "react";
import { api, money, type Row } from "../api";
import { qc, useData } from "../app/state";
import { Feedback, Load, PageTitle } from "../components/common";
export function Admin() {
  const [tab, setTab] = useState("Overview");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const dashboard = useData<Row>("/admin/dashboard");
  const members = useData("/admin/memberships");
  const cycles = useData("/admin/cycles");
  const orders = useData("/admin/orders");
  const societies = useData("/admin/societies");
  const products = useData("/admin/products");
  const suppliers = useData("/admin/suppliers");
  const categories = useData("/categories");
  const analytics = useData<Row>("/admin/analytics");
  const supplierOrders = useData("/admin/supplier-orders");
  const [summary, setSummary] = useState<Row[]>();
  const [editing, setEditing] = useState<Row>();
  const [selectedSociety, setSelectedSociety] = useState("");
  async function act(path: string, method: string, body?: unknown) {
    setError("");
    setNotice("");
    try {
      const result = await api(path, method, body);
      await qc.invalidateQueries();
      setNotice("Saved successfully.");
      return result;
    } catch (e) {
      setError((e as Error).message);
      return undefined;
    }
  }
  const tabs = [
    "Overview",
    "Memberships",
    "Societies",
    "Products",
    "Suppliers",
    "Buying cycles",
    "Orders",
    "Analytics",
  ];
  return (
    <>
      <PageTitle
        eyebrow="SOCIETYCART ADMINISTRATION"
        title="Your collective, at a glance."
        text="Live operational data. Demo transactions only."
      />
      <div className="tabs">
        {tabs.map((t) => (
          <button
            key={t}
            className={tab === t ? "selected" : ""}
            onClick={() => {
              setTab(t);
              setEditing(undefined);
            }}
          >
            {t}
          </button>
        ))}
      </div>
      <Feedback error={error} />
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      {tab === "Overview" && (
        <>
          <Load query={dashboard} />
          <div className="metrics">
            {dashboard.data &&
              Object.entries({
                Customers: dashboard.data.customers,
                Societies: dashboard.data.societies,
                "Active cycles": dashboard.data.activeCycles,
                "Pending approvals": dashboard.data.pendingMemberships,
                "Paid orders": dashboard.data.sales.paid_orders,
                "Gross merchandise value": money(
                  dashboard.data.sales.gmv_paise,
                ),
                "Customer savings": money(dashboard.data.sales.savings_paise),
                "Average order value": money(
                  dashboard.data.sales.average_paise,
                ),
                "Estimated product margin": money(
                  dashboard.data.estimatedMarginPaise,
                ),
              }).map(([k, v]) => (
                <article className="card" key={k}>
                  <small>{k}</small>
                  <h2>{v as string}</h2>
                </article>
              ))}
          </div>
          <p>
            Estimated margin excludes fulfillment and overhead. GMV is not
            recognized revenue.
          </p>
        </>
      )}
      {tab === "Analytics" && (
        <>
          <Load query={analytics} />
          <div className="metrics">
            <article className="card">
              <small>Repeat customers</small>
              <h2>{analytics.data?.repeatCustomers}</h2>
            </article>
            <article className="card">
              <small>Fulfillment backlog</small>
              <h2>{analytics.data?.fulfillmentBacklog}</h2>
            </article>
          </div>
          {[
            ["salesBySociety", "Sales by society"],
            ["ordersByCycle", "Orders per collective"],
            ["popularProducts", "Popular products"],
          ].map(([key, label]) => (
            <section className="card" key={key}>
              <h2>{label}</h2>
              {analytics.data?.[key].map((r: Row, i: number) => (
                <div className="section-row" key={i}>
                  <p>
                    {r.name} · {r.orders ?? r.quantity}{" "}
                    {r.quantity ? "packs" : "orders"}
                  </p>
                  <b>{money(r.sales_paise)}</b>
                </div>
              ))}
            </section>
          ))}
        </>
      )}
      {tab === "Memberships" && (
        <>
          <Load query={members} />
          {members.data?.map((m) => (
            <article className="card admin-row" key={m.id}>
              <div>
                <h3>{m.name}</h3>
                <p>
                  {m.email} · {m.society_name} · Flat {m.flat}
                </p>
                <span className="badge">{m.status}</span>
              </div>
              <div className="actions">
                <button
                  onClick={() =>
                    act("/admin/memberships/" + m.id, "PATCH", {
                      status: "APPROVED",
                    })
                  }
                >
                  Approve
                </button>
                <button
                  className="secondary"
                  onClick={() =>
                    act("/admin/memberships/" + m.id, "PATCH", {
                      status: "REJECTED",
                    })
                  }
                >
                  Reject
                </button>
              </div>
            </article>
          ))}
        </>
      )}
      {tab === "Societies" && (
        <>
          <section className="card">
            <h2>{editing ? "Edit society" : "Create society"}</h2>
            <form
              key={editing?.id || "new"}
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                if (
                  await act(
                    "/admin/societies" + (editing ? "/" + editing.id : ""),
                    editing ? "PATCH" : "POST",
                    {
                      name: f.get("name"),
                      location: f.get("location"),
                      active: f.get("active") === "on",
                    },
                  )
                )
                  setEditing(undefined);
              }}
            >
              <label>
                Name
                <input name="name" defaultValue={editing?.name} required />
              </label>
              <label>
                Location
                <input
                  name="location"
                  defaultValue={editing?.location}
                  required
                />
              </label>
              <label className="check">
                <input
                  name="active"
                  type="checkbox"
                  defaultChecked={editing?.active ?? true}
                />
                Active
              </label>
              <button>Save society</button>
            </form>
          </section>
          {societies.data?.map((s) => (
            <div className="card admin-row" key={s.id}>
              <h3>
                {s.name} · {s.location}
              </h3>
              <button className="secondary" onClick={() => setEditing(s)}>
                Edit
              </button>
            </div>
          ))}
        </>
      )}
      {tab === "Products" && (
        <>
          <section className="card">
            <h2>Create category</h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await act("/admin/categories", "POST", {
                  name: new FormData(e.currentTarget).get("name"),
                });
              }}
            >
              <label>
                Category name
                <input name="name" required />
              </label>
              <button>Add category</button>
            </form>
          </section>
          <section className="card">
            <h2>{editing ? "Edit product" : "Create product"}</h2>
            <form
              key={editing?.id || "new"}
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                await act(
                  "/admin/products" + (editing ? "/" + editing.id : ""),
                  editing ? "PATCH" : "POST",
                  {
                    categoryId: f.get("categoryId"),
                    name: f.get("name"),
                    brand: f.get("brand"),
                    packSize: f.get("packSize"),
                    image: f.get("image"),
                    active: f.get("active") === "on",
                  },
                );
              }}
            >
              <div className="form-grid">
                {[
                  ["name", "Product name"],
                  ["brand", "Brand"],
                  ["packSize", "Pack size"],
                  ["image", "Placeholder emoji or image label"],
                ].map(([k, l]) => (
                  <label key={k}>
                    {l}
                    <input
                      name={k}
                      defaultValue={
                        editing?.[k === "packSize" ? "pack_size" : k] ||
                        (k === "image" ? "🌾" : "")
                      }
                      required
                    />
                  </label>
                ))}
                <label>
                  Category
                  <select name="categoryId" defaultValue={editing?.category_id}>
                    {categories.data?.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="check">
                  <input
                    name="active"
                    type="checkbox"
                    defaultChecked={editing?.active ?? true}
                  />
                  Active
                </label>
              </div>
              <button>Save product</button>
            </form>
          </section>
          {products.data?.map((p) => (
            <div className="card admin-row" key={p.id}>
              <h3>
                {p.image} {p.name} · {p.pack_size}
              </h3>
              <button className="secondary" onClick={() => setEditing(p)}>
                Edit
              </button>
            </div>
          ))}
        </>
      )}
      {tab === "Suppliers" && (
        <>
          <section className="card">
            <h2>Create supplier</h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                await act("/admin/suppliers", "POST", Object.fromEntries(f));
              }}
            >
              <label>
                Supplier name
                <input name="name" required />
              </label>
              <label>
                Email
                <input type="email" name="email" required />
              </label>
              <button>Create supplier</button>
            </form>
          </section>
          {suppliers.data?.map((s) => (
            <section className="card" key={s.id}>
              <h3>{s.name}</h3>
              <p>
                {s.email} · {s.active ? "Active" : "Inactive"}
              </p>
              <details>
                <summary>Edit supplier and quotation</summary>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    await act("/admin/suppliers/" + s.id, "PATCH", {
                      name: f.get("name"),
                      email: f.get("email"),
                      active: f.get("active") === "on",
                    });
                  }}
                >
                  <label>
                    Name
                    <input name="name" defaultValue={s.name} required />
                  </label>
                  <label>
                    Email
                    <input
                      type="email"
                      name="email"
                      defaultValue={s.email}
                      required
                    />
                  </label>
                  <label className="check">
                    <input
                      type="checkbox"
                      name="active"
                      defaultChecked={s.active}
                    />
                    Active
                  </label>
                  <button>Save supplier</button>
                </form>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    await act(
                      "/admin/suppliers/" + s.id + "/products",
                      "POST",
                      {
                        productId: f.get("productId"),
                        costPaise: Number(f.get("costPaise")),
                      },
                    );
                  }}
                >
                  <label>
                    Assign product
                    <select name="productId">
                      {products.data?.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Quoted unit cost (paise)
                    <input
                      type="number"
                      name="costPaise"
                      min={0}
                      step={1}
                      required
                    />
                  </label>
                  <button>Save quotation</button>
                </form>
              </details>
            </section>
          ))}
          <section className="card">
            <h2>Supplier order statuses</h2>
            {supplierOrders.data?.map((o) => (
              <label key={o.id}>
                {o.supplier_name} · {o.cycle_name}
                <select
                  value={o.status}
                  onChange={(e) =>
                    act("/admin/supplier-orders/" + o.id, "PATCH", {
                      status: e.target.value,
                    })
                  }
                >
                  {["CREATED", "CONFIRMED", "DISPATCHED", "RECEIVED"].map(
                    (t) => (
                      <option key={t}>{t}</option>
                    ),
                  )}
                </select>
              </label>
            ))}
          </section>
        </>
      )}
      {tab === "Buying cycles" && (
        <>
          <section className="card">
            <h2>Open a new collective</h2>
            <p>
              Prices are integer paise. Reference prices must have a source.
              This form creates a cycle with one product; API clients can submit
              multiple products.
            </p>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                await act("/admin/cycles", "POST", {
                  societyId: f.get("societyId"),
                  name: f.get("name"),
                  startsAt: new Date(String(f.get("startsAt"))).toISOString(),
                  cutoffAt: new Date(String(f.get("cutoffAt"))).toISOString(),
                  minimumPaise: Number(f.get("minimumPaise")),
                  prices: [
                    {
                      productId: f.get("productId"),
                      supplierId: f.get("supplierId"),
                      pricePaise: Number(f.get("pricePaise")),
                      referencePaise: Number(f.get("referencePaise")),
                      costPaise: Number(f.get("costPaise")),
                      stock: Number(f.get("stock")),
                      referenceSource: f.get("referenceSource"),
                    },
                  ],
                });
              }}
            >
              <div className="form-grid">
                <label>
                  Society
                  <select
                    name="societyId"
                    value={selectedSociety || societies.data?.[0]?.id || ""}
                    onChange={(e) => setSelectedSociety(e.target.value)}
                    required
                  >
                    {societies.data?.map((s) => (
                      <option value={s.id} key={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Cycle name
                  <input name="name" required />
                </label>
                <label>
                  Start
                  <input type="datetime-local" name="startsAt" required />
                </label>
                <label>
                  Order cutoff
                  <input type="datetime-local" name="cutoffAt" required />
                </label>
                <label>
                  Product
                  <select name="productId" required>
                    {products.data?.map((p) => (
                      <option value={p.id} key={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Supplier
                  <select name="supplierId" required>
                    {suppliers.data?.map((s) => (
                      <option value={s.id} key={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
                {[
                  ["minimumPaise", "Minimum group total (paise)"],
                  ["pricePaise", "Group price (paise)"],
                  ["referencePaise", "Reference price (paise)"],
                  ["costPaise", "Supplier cost (paise)"],
                  ["stock", "Available packs"],
                ].map(([n, l]) => (
                  <label key={n}>
                    {l}
                    <input
                      type="number"
                      min={n === "pricePaise" || n === "referencePaise" ? 1 : 0}
                      step={1}
                      name={n}
                      required
                    />
                  </label>
                ))}
                <label>
                  Reference price source
                  <input name="referenceSource" required />
                </label>
              </div>
              <button>Create buying cycle</button>
            </form>
          </section>
          {cycles.data?.map((c) => (
            <article className="card admin-row" key={c.id}>
              <div>
                <h3>{c.name}</h3>
                <p>
                  {c.society_name} · {c.status} · Minimum{" "}
                  {money(c.minimum_paise)}
                </p>
              </div>
              <div className="actions">
                {c.status === "OPEN" && (
                  <button
                    onClick={() =>
                      act("/admin/cycles/" + c.id + "/close", "POST")
                    }
                  >
                    Close cycle now
                  </button>
                )}
                <button
                  className="secondary"
                  onClick={async () => {
                    try {
                      setSummary(
                        await api<Row[]>("/admin/cycles/" + c.id + "/summary"),
                      );
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  Supplier summary
                </button>
              </div>
            </article>
          ))}
          {summary && (
            <section className="card">
              <h2>Consolidated procurement</h2>
              {summary.length ? (
                summary.map((s, i) => (
                  <p key={i}>
                    {s.supplier} · {s.product} × {s.quantity} · Unit cost{" "}
                    {money(s.cost_paise)}
                  </p>
                ))
              ) : (
                <p>
                  No procurement generated. Only successfully closed cycles
                  generate supplier orders.
                </p>
              )}
            </section>
          )}
        </>
      )}
      {tab === "Orders" && (
        <>
          <Load query={orders} />
          {orders.data?.map((o) => (
            <article className="card" key={o.id}>
              <div className="section-row">
                <h3>
                  {o.customer} · {o.id.slice(0, 8)}
                </h3>
                <b>{money(o.total_paise)}</b>
              </div>
              <p>
                {o.status} · {o.tracking_status} · Flat {o.flat}
              </p>
              {o.fulfillment_id && (
                <label>
                  Fulfillment status
                  <select
                    value={o.tracking_status}
                    onChange={(e) =>
                      act("/admin/fulfillments/" + o.fulfillment_id, "PATCH", {
                        status: e.target.value,
                      })
                    }
                  >
                    {[
                      "PROCESSING",
                      "SUPPLIER_CONFIRMED",
                      "PACKED",
                      o.method === "DELIVERY"
                        ? "OUT_FOR_DELIVERY"
                        : "READY_FOR_COLLECTION",
                      "DELIVERED",
                    ].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                  <small>Advance one stage at a time.</small>
                </label>
              )}
              {o.status === "PAID" && !o.fulfillment_id && (
                <button
                  className="secondary"
                  onClick={() =>
                    act("/admin/orders/" + o.id + "/refund", "POST")
                  }
                >
                  Simulate cancellation & refund
                </button>
              )}
            </article>
          ))}
        </>
      )}
    </>
  );
}
