import { QueryClientProvider } from "@tanstack/react-query";
import { LogOut, ShoppingBag, ShoppingBasket } from "lucide-react";
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Link,
  Route,
  Routes,
  useNavigate,
} from "react-router-dom";
import { api, type Row } from "./api";
import { CartContext, qc, useCart, useData, type Cart } from "./app/state";
import { Welcome } from "./components/Welcome";
import { Admin } from "./features/admin";
import { Auth, Protected } from "./features/auth";
import { CartPage } from "./features/cart";
import { ProductDetail, Shop } from "./features/catalog";
import { Profile, Societies } from "./features/customer";
import { Orders } from "./features/orders";
import "./style.css";
function App() {
  const [cart, setCart] = useState<Cart>({ cycleId: "", items: [] });
  return (
    <CartContext.Provider value={{ cart, setCart }}>
      <Shell />
    </CartContext.Provider>
  );
}
function Shell() {
  const me = useData<Row>("/auth/me");
  const { cart, setCart } = useCart();
  const navigate = useNavigate();
  return (
    <>
      <div className="announcement">
        A little community. A lot more savings.{" "}
        <span>Demo store · simulated payments only</span>
      </div>
      <header>
        <Link to="/" className="logo">
          <span>
            <ShoppingBasket />
          </span>
          Society<span className="logo-cart">Cart</span>
        </Link>
        <nav>
          <Link to="/shop">Shop groceries</Link>
          <Link to="/societies">My society</Link>
          <Link to="/orders">My orders</Link>
          {me.data?.role === "ADMIN" && <Link to="/admin">Admin</Link>}
        </nav>
        <div className="header-actions">
          <Link className="cart-button" to="/cart">
            <ShoppingBag size={20} />
            <span>{cart.items.reduce((n, p) => n + p.quantity, 0)}</span>
          </Link>
          {me.data ? (
            <button
              aria-label="Log out"
              className="icon"
              onClick={async () => {
                await api("/auth/logout", "POST");
                setCart({ cycleId: "", items: [] });
                qc.clear();
                navigate("/login");
              }}
            >
              <LogOut size={20} />
            </button>
          ) : (
            <Link className="button small" to="/login">
              Sign in
            </Link>
          )}
        </div>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Welcome />} />
          <Route path="/login" element={<Auth />} />
          <Route path="/register" element={<Auth register />} />
          <Route
            path="/societies"
            element={
              <Protected>
                <Societies />
              </Protected>
            }
          />
          <Route
            path="/shop"
            element={
              <Protected>
                <Shop />
              </Protected>
            }
          />
          <Route
            path="/products/:id"
            element={
              <Protected>
                <ProductDetail />
              </Protected>
            }
          />
          <Route
            path="/cart"
            element={
              <Protected>
                <CartPage />
              </Protected>
            }
          />
          <Route
            path="/orders"
            element={
              <Protected>
                <Orders />
              </Protected>
            }
          />
          <Route
            path="/profile"
            element={
              <Protected>
                <Profile />
              </Protected>
            }
          />
          <Route
            path="/admin"
            element={
              <Protected admin>
                <Admin />
              </Protected>
            }
          />
          <Route
            path="*"
            element={
              <div className="empty">
                <h1>Page not found</h1>
                <Link to="/">Back home</Link>
              </div>
            }
          />
        </Routes>
      </main>
      <footer>
        <div className="logo">
          <ShoppingBasket /> SocietyCart
        </div>
        <p>Buy Together. Save Together.</p>
        <p>Built for neighbours. Better for every home.</p>
        <Link to="/profile">My account</Link>
        <small>
          All seed prices are illustrative demo prices. No real payments are
          collected.
        </small>
      </footer>
    </>
  );
}
const root = document.getElementById("root");
if (root)
  createRoot(root).render(
    <React.StrictMode>
      <QueryClientProvider client={qc}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </React.StrictMode>,
  );
