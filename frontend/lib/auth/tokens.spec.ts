import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearAuthToken,
  getAuthToken,
  getTokenChangedEventName,
  setAuthToken,
} from "@/lib/auth/tokens";

describe("auth token storage", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("stores tokens in sessionStorage and not localStorage", () => {
    const localStorageSpy = vi.spyOn(window.localStorage, "setItem");

    setAuthToken("admin", "token-123");

    expect(getAuthToken("admin")).toBe("token-123");
    expect(window.sessionStorage.getItem("hrbuddy.admin.sessionToken")).toBe("token-123");
    expect(localStorageSpy).not.toHaveBeenCalled();
  });

  it("emits token changed event on set and clear", () => {
    const listener = vi.fn();
    window.addEventListener(getTokenChangedEventName(), listener);

    setAuthToken("employee", "abc");
    clearAuthToken("employee");

    expect(listener).toHaveBeenCalledTimes(2);
    window.removeEventListener(getTokenChangedEventName(), listener);
  });

  it("returns null when token does not exist", () => {
    expect(getAuthToken("messenger")).toBeNull();
  });
});
