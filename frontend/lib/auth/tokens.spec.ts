import { beforeEach, describe, expect, it, vi } from "vitest";

describe("auth token storage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    delete process.env.NEXT_PUBLIC_AUTH_TOKEN_STORAGE;
    window.sessionStorage.clear();
    window.localStorage.clear();
  });

  it("stores tokens in memory by default", async () => {
    const { setAuthToken, getAuthToken } = await import("@/lib/auth/tokens");
    const sessionStorageSpy = vi.spyOn(window.sessionStorage, "setItem");
    const localStorageSpy = vi.spyOn(window.localStorage, "setItem");

    setAuthToken("admin", "token-123");

    expect(getAuthToken("admin")).toBe("token-123");
    expect(sessionStorageSpy).not.toHaveBeenCalled();
    expect(localStorageSpy).not.toHaveBeenCalled();
  });

  it("supports optional session persistence mode", async () => {
    process.env.NEXT_PUBLIC_AUTH_TOKEN_STORAGE = "session";
    const { setAuthToken, getAuthToken, clearAuthToken, getTokenStorageKey } = await import("@/lib/auth/tokens");

    setAuthToken("employee", "persisted-token");
    expect(window.sessionStorage.getItem(getTokenStorageKey("employee"))).toBe("persisted-token");
    expect(getAuthToken("employee")).toBe("persisted-token");

    clearAuthToken("employee");
    expect(window.sessionStorage.getItem(getTokenStorageKey("employee"))).toBeNull();
  });

  it("emits token changed event on set and clear", async () => {
    const { setAuthToken, clearAuthToken, getTokenChangedEventName } = await import("@/lib/auth/tokens");

    const listener = vi.fn();
    window.addEventListener(getTokenChangedEventName(), listener);

    setAuthToken("employee", "abc");
    clearAuthToken("employee");

    expect(listener).toHaveBeenCalledTimes(2);
    window.removeEventListener(getTokenChangedEventName(), listener);
  });

  it("returns null when token does not exist", async () => {
    const { getAuthToken } = await import("@/lib/auth/tokens");
    expect(getAuthToken("messenger")).toBeNull();
  });
});
