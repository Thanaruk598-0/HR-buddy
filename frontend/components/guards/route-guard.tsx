"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ApiError, apiFetch } from "@/lib/api/client";
import { clearAuthToken, type TokenType } from "@/lib/auth/tokens";
import { useAuthToken } from "@/lib/auth/use-auth-token";

type RouteGuardProps = {
  tokenType: TokenType;
  redirectTo: string;
  children: ReactNode;
};

type SessionValidationConfig = {
  path: string;
  query?: Record<string, string | number | boolean>;
};

const SESSION_VALIDATION_BY_TOKEN: Partial<Record<TokenType, SessionValidationConfig>> = {
  admin: {
    path: "/admin/auth/me",
  },
  employee: {
    path: "/requests/my",
    query: {
      page: 1,
      limit: 1,
    },
  },
};

export function RouteGuard({ tokenType, redirectTo, children }: RouteGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const token = useAuthToken(tokenType);
  const validationConfig = useMemo(() => SESSION_VALIDATION_BY_TOKEN[tokenType], [tokenType]);

  const [isValidating, setIsValidating] = useState(false);
  const [isValidated, setIsValidated] = useState(false);

  useEffect(() => {
    if (!token) {
      setIsValidating(false);
      setIsValidated(false);
      router.replace(`${redirectTo}?next=${encodeURIComponent(pathname || "/")}`);
    }
  }, [token, pathname, redirectTo, router]);

  useEffect(() => {
    let active = true;

    async function validateSession() {
      if (!token) {
        return;
      }

      if (!validationConfig) {
        setIsValidating(false);
        setIsValidated(true);
        return;
      }

      setIsValidating(true);
      setIsValidated(false);

      try {
        await apiFetch<unknown>(validationConfig.path, {
          method: "GET",
          tokenType,
          query: validationConfig.query,
        });

        if (!active) {
          return;
        }

        setIsValidated(true);
      } catch (error) {
        if (!active) {
          return;
        }

        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
          clearAuthToken(tokenType);
          setIsValidated(false);
          router.replace(`${redirectTo}?next=${encodeURIComponent(pathname || "/")}`);
          return;
        }

        // Keep UX resilient on transient network issues.
        setIsValidated(true);
      } finally {
        if (active) {
          setIsValidating(false);
        }
      }
    }

    void validateSession();

    return () => {
      active = false;
    };
  }, [token, tokenType, validationConfig, pathname, redirectTo, router]);

  if (!token || isValidating || !isValidated) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center justify-center px-6 py-10">
        <div className="w-full rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <p className="text-sm font-medium text-slate-600">Checking session...</p>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
