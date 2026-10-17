// @vitest-environment jsdom
import React, { useState } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Auth, Protected } from "./features/auth";
import { Societies } from "./features/customer";
import { ProductCard } from "./features/catalog";
import { CartContext } from "./app/state";
import { CartPage } from "./features/cart";
import { Orders } from "./features/orders";
import { api } from "./api";
vi.mock("./api", async (original) => ({
  ...(await original<typeof import("./api")>()),
  api: vi.fn(),
}));
const mock = vi.mocked(api);
function mount(ui: React.ReactNode) {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}
afterEach(cleanup);
beforeEach(() => mock.mockReset());
describe("customer screens", () => {
  it("submits validated login credentials", async () => {
    mock.mockResolvedValue({ id: "u" });
    mount(<Auth />);
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "resident@example.test" },
    });
    fireEvent.change(screen.getByLabelText(/Password/), {
      target: { value: "Test-password-123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Sign in/ }));
    await waitFor(() =>
      expect(mock).toHaveBeenCalledWith(
        "/auth/login",
        "POST",
        expect.objectContaining({ email: "resident@example.test" }),
      ),
    );
  });
  it("blocks admin content for customers", async () => {
    mock.mockResolvedValue({ role: "CUSTOMER" });
    mount(
      <Protected admin>
        <div>Secret dashboard</div>
      </Protected>,
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Administrator access required",
    );
    expect(screen.queryByText("Secret dashboard")).not.toBeInTheDocument();
  });
  it("requests society membership with a flat number", async () => {
    mock.mockImplementation(async (path) =>
      path === "/memberships/me"
        ? []
        : path?.startsWith("/societies")
          ? [{ id: "s1", name: "Green Valley", location: "Pune" }]
          : {},
    );
    mount(<Societies />);
    await screen.findByText("Green Valley");
    fireEvent.change(screen.getByPlaceholderText("e.g. A-204"), {
      target: { value: "A-204" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Request to join" }));
    await waitFor(() =>
      expect(mock).toHaveBeenCalledWith("/memberships", "POST", {
        societyId: "s1",
        flat: "A-204",
      }),
    );
  });
  it("adds a catalog item to the cart", () => {
    function Wrapper() {
      const [cart, setCart] = useState({
        cycleId: "",
        items: [] as Record<string, any>[],
      });
      return (
        <CartContext.Provider value={{ cart, setCart }}>
          <ProductCard
            product={{
              id: "p",
              name: "Rice",
              image: "🌾",
              brand: "Demo",
              pack_size: "5 kg",
              price_paise: 10000,
              reference_paise: 12000,
              stock: 5,
            }}
            cycleId="c"
          />
          <output>
            {cart.items.reduce((n, p) => n + p.quantity, 0)} items
          </output>
        </CartContext.Provider>
      );
    }
    mount(<Wrapper />);
    fireEvent.click(screen.getByRole("button", { name: /Add/ }));
    expect(screen.getByText("1 items")).toBeInTheDocument();
  });
  it("creates an authoritative pending order before offering simulation", async () => {
    mock.mockImplementation(async (path, method) =>
      path === "/memberships/me"
        ? [{ society_id: "s", society_name: "Green Valley", flat: "A-204" }]
        : method === "POST"
          ? { id: "order", total_paise: 10000 }
          : { cycle: { society_id: "s", cutoff_at: new Date().toISOString() } },
    );
    const cart = {
      cycleId: "c",
      items: [
        {
          id: "p",
          name: "Rice",
          pack_size: "5 kg",
          quantity: 1,
          price_paise: 10000,
          reference_paise: 12000,
          stock: 5,
        },
      ],
    };
    mount(
      <CartContext.Provider value={{ cart, setCart: vi.fn() }}>
        <CartPage />
      </CartContext.Provider>,
    );
    fireEvent.click(screen.getByRole("button", { name: /Confirm order/ }));
    expect(
      await screen.findByRole("button", {
        name: "Simulate successful payment",
      }),
    ).toBeInTheDocument();
    expect(mock).toHaveBeenCalledWith(
      "/orders",
      "POST",
      expect.objectContaining({
        cycleId: "c",
        items: [{ productId: "p", quantity: 1 }],
      }),
    );
  });
  it("shows backend fulfillment and payment status", async () => {
    mock.mockResolvedValue([
      {
        id: "12345678-foo",
        cycle_name: "Weekly collective",
        tracking_status: "PACKED",
        status: "PAID",
        payment_status: "PAID",
        total_paise: 10000,
        savings_paise: 2000,
        created_at: new Date().toISOString(),
        method: "COLLECTION",
        flat: "A-204",
      },
    ]);
    mount(<Orders />);
    expect(await screen.findByText("PACKED")).toBeInTheDocument();
    expect(screen.getByText("Payment: PAID")).toBeInTheDocument();
  });
});
