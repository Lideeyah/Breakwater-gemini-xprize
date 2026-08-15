"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useBreakwaterSocket, type UseSocketReturn } from "../hooks/useBreakwaterSocket";

const Ctx = createContext<UseSocketReturn | null>(null);

export function SocketProvider({ children }: { children: ReactNode }) {
  const value = useBreakwaterSocket();
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSocket(): UseSocketReturn {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSocket must be used within SocketProvider");
  return v;
}
