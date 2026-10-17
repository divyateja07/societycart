import { QueryClient, useQuery } from "@tanstack/react-query";
import React, { createContext, useContext } from "react";
import { api, type Row } from "../api";
export const qc = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: 10000 } },
});
export type Cart = { cycleId: string; items: Row[] };
export const CartContext = createContext<{
  cart: Cart;
  setCart: React.Dispatch<React.SetStateAction<Cart>>;
}>({ cart: { cycleId: "", items: [] }, setCart: () => {} });
export const useCart = () => useContext(CartContext);
export function useData<T = Row[]>(key: string, path = key) {
  return useQuery<T>({
    queryKey: [key],
    queryFn: () => api<T>(path),
    refetchInterval:
      key.startsWith("/admin/") || key === "/cycles/active" ? 15000 : false,
  });
}
