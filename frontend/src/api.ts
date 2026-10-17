export type Row = Record<string, any>;
let csrf: { token: string; headerName: string } | undefined;
export async function api<T = Row>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  if (method !== "GET" && !csrf)
    csrf = await fetch("/api/v1/auth/csrf", { credentials: "include" }).then(
      (r) => r.json(),
    );
  const r = await fetch("/api/v1" + path, {
    method,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(method !== "GET" && csrf ? { [csrf.headerName]: csrf.token } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (path === "/auth/logout" || r.status === 401 || r.status === 403)
    csrf = undefined;
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.message || `Request failed (${r.status})`);
  }
  return r.json();
}
export const money = (paise: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(paise / 100);
export function totals(
  items: { quantity: number; price_paise: number; reference_paise: number }[],
) {
  return items.reduce(
    (a, p) => ({
      total: a.total + p.quantity * p.price_paise,
      savings: a.savings + p.quantity * (p.reference_paise - p.price_paise),
    }),
    { total: 0, savings: 0 },
  );
}
