import { describe, expect, it, vi } from "vitest";
import { money, totals } from "./api";
describe("cart pricing", () => {
  it("uses quantities and integer paise", () => {
    expect(
      totals([
        { quantity: 3, price_paise: 14500, reference_paise: 17500 },
        { quantity: 2, price_paise: 2200, reference_paise: 2800 },
      ]),
    ).toEqual({ total: 47900, savings: 10200 });
  });
  it("handles an empty basket", () => {
    expect(totals([])).toEqual({ total: 0, savings: 0 });
  });
  it("formats rupees", () => {
    expect(money(12345)).toContain("123.45");
  });
});

it("refreshes the CSRF token after logout before a new login", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: "first", headerName: "X-CSRF-TOKEN" }),
    })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: "second", headerName: "X-CSRF-TOKEN" }),
    })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ id: "user" }) });
  vi.stubGlobal("fetch", fetchMock);
  try {
    const { api: client } = await import("./api");
    await client("/auth/logout", "POST");
    await client("/auth/login", "POST", {
      email: "resident@example.test",
      password: "not-a-real-credential",
    });
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls[3][1].headers["X-CSRF-TOKEN"]).toBe("second");
  } finally {
    vi.unstubAllGlobals();
  }
});
