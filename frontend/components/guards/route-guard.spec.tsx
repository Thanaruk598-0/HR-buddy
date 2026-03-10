import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import { RouteGuard } from "@/components/guards/route-guard";

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  useAuthToken: vi.fn(),
  apiFetch: vi.fn(),
  clearAuthToken: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mocks.replace,
  }),
  usePathname: () => "/admin",
}));

vi.mock("@/lib/auth/use-auth-token", () => ({
  useAuthToken: (type: unknown) => mocks.useAuthToken(type),
}));

vi.mock("@/lib/api/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/client")>("@/lib/api/client");
  return {
    ...actual,
    apiFetch: (...args: unknown[]) => mocks.apiFetch(...args),
  };
});

vi.mock("@/lib/auth/tokens", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/tokens")>("@/lib/auth/tokens");
  return {
    ...actual,
    clearAuthToken: (type: unknown) => mocks.clearAuthToken(type),
  };
});

function renderGuard() {
  return render(
    <RouteGuard tokenType="admin" redirectTo="/admin/login">
      <div>Protected content</div>
    </RouteGuard>,
  );
}

describe("RouteGuard", () => {
  beforeEach(() => {
    mocks.replace.mockReset();
    mocks.useAuthToken.mockReset();
    mocks.apiFetch.mockReset();
    mocks.clearAuthToken.mockReset();
  });

  it("redirects to login when token is missing", async () => {
    mocks.useAuthToken.mockReturnValue(null);

    renderGuard();

    await waitFor(() => {
      expect(mocks.replace).toHaveBeenCalledWith("/admin/login?next=%2Fadmin");
    });

    expect(screen.getByText("Checking session...")).toBeInTheDocument();
  });

  it("renders protected content when token and session are valid", async () => {
    mocks.useAuthToken.mockReturnValue("valid-token");
    mocks.apiFetch.mockResolvedValue({ username: "admin" });

    renderGuard();

    await waitFor(() => {
      expect(screen.getByText("Protected content")).toBeInTheDocument();
    });

    expect(mocks.apiFetch).toHaveBeenCalledWith(
      "/admin/auth/me",
      expect.objectContaining({
        method: "GET",
        tokenType: "admin",
      }),
    );
  });

  it("fails closed on network errors and allows retry", async () => {
    mocks.useAuthToken.mockReturnValue("valid-token");

    let shouldSucceed = false;
    mocks.apiFetch.mockImplementation(() => {
      if (shouldSucceed) {
        return Promise.resolve({ username: "admin" });
      }

      return Promise.reject(new Error("network down"));
    });

    renderGuard();

    await waitFor(() => {
      expect(screen.getByText("Session Validation Failed")).toBeInTheDocument();
    });

    expect(screen.queryByText("Protected content")).not.toBeInTheDocument();

    shouldSucceed = true;
    fireEvent.click(screen.getByRole("button", { name: "Retry session check" }));

    await waitFor(() => {
      expect(screen.getByText("Protected content")).toBeInTheDocument();
    });
  });

  it("clears token and redirects when API returns unauthorized", async () => {
    mocks.useAuthToken.mockReturnValue("expired-token");
    mocks.apiFetch.mockRejectedValue(new ApiError(401, { message: "Unauthorized" }, "Unauthorized"));

    renderGuard();

    await waitFor(() => {
      expect(mocks.clearAuthToken).toHaveBeenCalledWith("admin");
    });

    await waitFor(() => {
      expect(mocks.replace).toHaveBeenCalledWith("/admin/login?next=%2Fadmin");
    });
  });
});
