import { useSyncExternalStore } from "react";
import { getAuthToken, type TokenType } from "@/lib/auth/tokens";

const noop = () => {};

function subscribe(listener: () => void) {
  if (typeof window === "undefined") {
    return noop;
  }

  const onStorage = () => listener();
  window.addEventListener("storage", onStorage);

  return () => {
    window.removeEventListener("storage", onStorage);
  };
}

export function useAuthToken(type: TokenType) {
  return useSyncExternalStore(
    subscribe,
    () => getAuthToken(type),
    () => null,
  );
}
