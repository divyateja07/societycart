import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ShoppingBag } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, money, totals, type Row } from "../api";
import { qc, useCart, useData } from "../app/state";
import { Feedback, PageTitle } from "../components/common";
export function CartPage() {
  const { cart, setCart } = useCart();
  const [method, setMethod] = useState("COLLECTION");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [order, setOrder] = useState<Row>();
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [confirmed, setConfirmed] = useState(false);
  const navigate = useNavigate();
  const sums = totals(
    cart.items as {
      quantity: number;
      price_paise: number;
      reference_paise: number;
    }[],
  );
  const memberships = useData("/memberships/me");
  const cycle = useQuery<Row>({
    queryKey: ["cart-cycle", cart.cycleId],
    queryFn: () => api("/cycles/" + cart.cycleId),
    enabled: !!cart.cycleId,
  });
  const membership = memberships.data?.find(
    (m) => m.society_id === cycle.data?.cycle.society_id,
  );
  async function pay(success: boolean) {
    setBusy(true);
    try {
      await api("/payments/simulate", "POST", { orderId: order?.id, success });
      setConfirmed(true);
      setCart({ cycleId: "", items: [] });
      await qc.invalidateQueries();
      navigate("/orders");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!cart.items.length && !order)
    return (
      <div className="empty">
        <ShoppingBag size={44} />
        <h1>A little empty. A lot of possibilities.</h1>
        <Link className="button" to="/shop">
          Explore groceries
        </Link>
      </div>
    );
  return (
    <>
      <PageTitle
        eyebrow="YOUR SHARED PANTRY"
        title="A basket of better value."
      />
      <Feedback error={error} />
      <div className="checkout-layout">
        <section className="card">
          {cart.items.map((p) => (
            <div className="cart-row" key={p.id}>
              <span className="cart-emoji">{p.image}</span>
              <div>
                <h3>{p.name}</h3>
                <small>{p.pack_size}</small>
              </div>
              <input
                aria-label={"Quantity " + p.name}
                type="number"
                min={1}
                max={Math.min(100, p.stock)}
                disabled={!!order}
                value={p.quantity}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (n >= 1 && n <= Math.min(100, p.stock)) {
                    setKey(crypto.randomUUID());
                    setCart((c) => ({
                      ...c,
                      items: c.items.map((x) =>
                        x.id === p.id ? { ...x, quantity: n } : x,
                      ),
                    }));
                  }
                }}
              />
              <b>{money(p.price_paise * p.quantity)}</b>
              <button
                className="text-button"
                disabled={!!order}
                onClick={() => {
                  setKey(crypto.randomUUID());
                  setCart((c) => ({
                    ...c,
                    items: c.items.filter((x) => x.id !== p.id),
                  }));
                }}
              >
                Remove
              </button>
            </div>
          ))}
          <p className="notice">
            Illustrative demo prices · Group orders proceed only when the
            minimum paid value is met. Failed cycles receive simulated refunds.
          </p>
        </section>
        <aside className="card summary">
          <h2>Checkout</h2>
          <p>
            {membership?.society_name} · Flat {membership?.flat}
          </p>
          <p>
            Cutoff:{" "}
            {cycle.data &&
              new Date(cycle.data.cycle.cutoff_at).toLocaleString()}
          </p>
          <label>
            Fulfillment
            <select
              disabled={!!order}
              value={method}
              onChange={(e) => setMethod(e.target.value)}
            >
              <option value="COLLECTION">Society collection</option>
              <option value="DELIVERY">Society doorstep delivery</option>
            </select>
          </label>
          <div>
            <span>Subtotal</span>
            <b>{money(sums.total)}</b>
          </div>
          <div>
            <span>Fulfillment</span>
            <b>Free in demo</b>
          </div>
          <div className="green">
            <span>Your savings</span>
            <b>{money(sums.savings)}</b>
          </div>
          <div className="grand-total">
            <span>Total</span>
            <b>{money(sums.total)}</b>
          </div>
          {!order ? (
            <button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  setOrder(
                    await api("/orders", "POST", {
                      cycleId: cart.cycleId,
                      items: cart.items.map((p) => ({
                        productId: p.id,
                        quantity: p.quantity,
                      })),
                      idempotencyKey: key,
                      method,
                    }),
                  );
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Confirm order <ArrowRight size={17} />
            </button>
          ) : (
            <>
              <p className="notice">
                TEST ONLY · No money will be charged. Authoritative order total:{" "}
                {money(order.total_paise)}
              </p>
              <button disabled={busy || confirmed} onClick={() => pay(true)}>
                Simulate successful payment
              </button>
              <button
                disabled={busy || confirmed}
                className="secondary"
                onClick={() => pay(false)}
              >
                Simulate failed payment
              </button>
            </>
          )}
        </aside>
      </div>
    </>
  );
}
