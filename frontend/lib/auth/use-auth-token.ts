import { useSyncExternalStore } from "react";
import { getAuthToken, getTokenChangedEventName, type TokenType } from "@/lib/auth/tokens";

const noop = () => {};

function subscribe(listener: () => void) {
  if (typeof window === "undefined") {
    return noop;
  }

  const onStorage = () => listener();
  const onTokenChanged = () => listener();

  window.addEventListener("storage", onStorage);
  window.addEventListener(getTokenChangedEventName(), onTokenChanged);

  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(getTokenChangedEventName(), onTokenChanged);
  };
}

export function useAuthToken(type: TokenType) {
  return useSyncExternalStore(
    subscribe,
    () => getAuthToken(type),
    () => null,
  );
}
