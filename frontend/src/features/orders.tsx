import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { api, money, type Row } from "../api";
import { qc, useData } from "../app/state";
import { Feedback, Load, PageTitle } from "../components/common";
export function Orders() {
  const q = useData("/orders/me");
  return (
    <>
      <PageTitle
        eyebrow="FROM OUR COLLECTIVE TO YOUR HOME"
        title="Your orders."
      />
      <Load query={q} />
      {q.data?.length === 0 && (
        <div className="empty">
          Your first collective basket is waiting.{" "}
          <Link to="/shop">Shop groceries</Link>
        </div>
      )}
      <div className="orders">
        {q.data?.map((o) => (
          <OrderCard key={o.id} order={o} />
        ))}
      </div>
    </>
  );
}
export function OrderCard({ order: o }: { order: Row }) {
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState("");
  const details = useQuery<Row>({
    queryKey: ["order", o.id],
    queryFn: () => api("/orders/" + o.id),
    enabled: expanded,
  });
  return (
    <article className="card">
      <div className="section-row">
        <div>
          <small>ORDER {o.id.slice(0, 8).toUpperCase()}</small>
          <h2>{o.cycle_name}</h2>
        </div>
        <span className="badge">{o.tracking_status?.replaceAll("_", " ")}</span>
      </div>
      <p>
        {new Date(o.created_at).toLocaleString()} · {o.method} · Flat {o.flat}
      </p>
      <div className="section-row">
        <b>{money(o.total_paise)}</b>
        <span className="green">Saved {money(o.savings_paise)}</span>
      </div>
      <p>
        Payment: {o.payment_status}{" "}
        {o.refund_status && "· Refund: " + o.refund_status}
      </p>
      <Feedback error={error} />
      {o.status === "PAYMENT_PENDING" && (
        <div className="actions">
          {[true, false].map((success) => (
            <button
              key={String(success)}
              className="secondary"
              onClick={async () => {
                try {
                  await api("/payments/simulate", "POST", {
                    orderId: o.id,
                    success,
                  });
                  await qc.invalidateQueries();
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              Simulate {success ? "success" : "failure"} (test only)
            </button>
          ))}
        </div>
      )}
      <button className="text-button" onClick={() => setExpanded(!expanded)}>
        {expanded ? "Hide" : "View"} order details
      </button>
      {expanded && (
        <>
          <Load query={details} />
          {details.data?.items.map((i: Row) => (
            <p key={i.id}>
              {i.name} × {i.quantity} <b>{money(i.price_paise * i.quantity)}</b>
            </p>
          ))}
        </>
      )}
    </article>
  );
}
