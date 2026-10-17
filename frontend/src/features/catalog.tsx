import { useQuery } from "@tanstack/react-query";
import { Minus, Plus, Search, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, money, type Row } from "../api";
import { useCart, useData } from "../app/state";
import { Feedback, Load, PageTitle } from "../components/common";
function Countdown({ cutoff }: { cutoff: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);
  const remaining = Math.max(0, new Date(cutoff).getTime() - now);
  const hours = Math.floor(remaining / 3600000),
    minutes = Math.floor(remaining / 60000) % 60,
    seconds = Math.floor(remaining / 1000) % 60;
  return (
    <p aria-label="Time until cutoff">
      {remaining
        ? `${hours}h ${minutes}m ${seconds}s left to join`
        : "Ordering deadline has passed"}
    </p>
  );
}
export function Shop() {
  const cycles = useData("/cycles/active");
  const [selected, setSelected] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All essentials");
  const id = selected || cycles.data?.[0]?.id;
  const details = useQuery<Row>({
    queryKey: ["cycle", id],
    queryFn: () => api("/cycles/" + id),
    enabled: !!id,
  });
  const products: Row[] = details.data?.products || [];
  const active = cycles.data?.find((c) => c.id === id);
  return (
    <>
      <PageTitle
        eyebrow="THE NEIGHBOURHOOD PANTRY"
        title="Everyday good. Together."
        text="Thoughtfully picked essentials. A better price when we buy as one."
      />
      <Load query={cycles} />
      {cycles.data?.length === 0 ? (
        <div className="empty">
          <Users size={40} />
          <h2>Your next collective is on its way.</h2>
          <p>
            Join a society and get approved, or ask your admin to open a buying
            cycle.
          </p>
          <Link className="button" to="/societies">
            Find your society
          </Link>
        </div>
      ) : (
        <>
          {active && (
            <section className="cycle-banner">
              <div>
                <div className="eyebrow">
                  YOUR ACTIVE COLLECTIVE · {active.society_name}
                </div>
                <h2>{active.name}</h2>
                <Countdown cutoff={active.cutoff_at} />
                <p>
                  Order by{" "}
                  {new Date(active.cutoff_at).toLocaleString("en-IN", {
                    timeZone: "Asia/Kolkata",
                  })}{" "}
                  IST
                </p>
              </div>
              <div className="cycle-progress">
                <b>
                  {money(active.paid_paise)}{" "}
                  <small>of {money(active.minimum_paise)} goal</small>
                </b>
                <progress
                  value={active.paid_paise}
                  max={Math.max(active.minimum_paise, 1)}
                />
                <small>Paid orders help unlock the collective.</small>
              </div>
            </section>
          )}
          <div className="catalog-toolbar">
            <label className="search">
              <Search size={19} />
              <input
                aria-label="Search groceries"
                placeholder="What’s on your grocery list?"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <select
              aria-label="Buying cycle"
              value={id || ""}
              onChange={(e) => setSelected(e.target.value)}
            >
              {cycles.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.society_name} · {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="tabs">
            {[
              "All essentials",
              ...new Set(products.map((p) => p.category)),
            ].map((c) => (
              <button
                className={c === category ? "selected" : ""}
                key={c}
                onClick={() => setCategory(c)}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="section-row">
            <h2>Your pantry favourites</h2>
            <span>Illustrative demo prices</span>
          </div>
          <Load query={details} />
          <div className="product-grid">
            {products
              .filter(
                (p) =>
                  (category === "All essentials" || p.category === category) &&
                  p.name.toLowerCase().includes(search.toLowerCase()),
              )
              .map((p) => (
                <ProductCard key={p.id} product={p} cycleId={id} />
              ))}
          </div>
          {products.length > 0 &&
            !products.some(
              (p) =>
                (category === "All essentials" || p.category === category) &&
                p.name.toLowerCase().includes(search.toLowerCase()),
            ) && <div className="empty">No groceries match your search.</div>}
        </>
      )}
    </>
  );
}
export function ProductCard({
  product: p,
  cycleId,
}: {
  product: Row;
  cycleId: string;
}) {
  const { cart, setCart } = useCart();
  const [error, setError] = useState("");
  const qty =
    cart.cycleId === cycleId
      ? cart.items.find((x) => x.id === p.id)?.quantity || 0
      : 0;
  function change(delta: number) {
    if (cart.items.length && cart.cycleId !== cycleId) {
      setError("Finish or clear your current collective’s basket first.");
      return;
    }
    setCart((c) => {
      const items = c.items.filter((x) => x.id !== p.id);
      if (qty + delta > 0) items.push({ ...p, quantity: qty + delta });
      return { cycleId, items };
    });
  }
  return (
    <article className="product-card">
      <Link
        to={"/products/" + p.id + "?cycle=" + cycleId}
        className="product-image"
      >
        <span className="saving-chip">
          Save{" "}
          {Math.floor(
            ((p.reference_paise - p.price_paise) * 100) / p.reference_paise,
          )}
          %
        </span>
        <span role="img" aria-label={p.name}>
          {p.image}
        </span>
      </Link>
      <div className="product-body">
        <small>{p.brand}</small>
        <Link to={"/products/" + p.id + "?cycle=" + cycleId}>
          <h3>{p.name}</h3>
        </Link>
        <p>{p.pack_size}</p>
        <div className="price-row">
          <div>
            <b>{money(p.price_paise)}</b> <del>{money(p.reference_paise)}</del>
            <small className="green">
              You save {money(p.reference_paise - p.price_paise)}
            </small>
          </div>
          {qty ? (
            <div className="quantity">
              <button
                aria-label={"Remove one " + p.name}
                onClick={() => change(-1)}
              >
                <Minus size={14} />
              </button>
              <span>{qty}</span>
              <button
                disabled={qty >= p.stock}
                aria-label={"Add one " + p.name}
                onClick={() => change(1)}
              >
                <Plus size={14} />
              </button>
            </div>
          ) : (
            <button
              className="add"
              disabled={!p.stock}
              onClick={() => change(1)}
            >
              Add <Plus size={15} />
            </button>
          )}
        </div>
        <Feedback error={error} />
      </div>
    </article>
  );
}
export function ProductDetail() {
  const { id } = useParams();
  const cycleId = new URLSearchParams(location.search).get("cycle") || "";
  const q = useData<Row>("detail-" + cycleId, "/cycles/" + cycleId);
  const p = q.data?.products.find((p: Row) => p.id === id);
  return (
    <>
      <Link to="/shop">← Back to pantry</Link>
      <Load query={q} />
      {p && (
        <div className="detail">
          <ProductCard product={p} cycleId={cycleId} />
          <div>
            <PageTitle
              eyebrow={p.category}
              title={p.name}
              text={`${p.brand} · ${p.pack_size}`}
            />
            <p>Availability: {p.stock} packs</p>
            <p>Reference price source: {p.reference_source}</p>
            <p>
              All prices shown include the product cost. Collection and delivery
              have no additional fee in this demo.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
