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

const SESSION_VALIDATION_ERROR = "Unable to verify session with backend. Please check API connectivity and try again.";

export function RouteGuard({ tokenType, redirectTo, children }: RouteGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const token = useAuthToken(tokenType);
  const validationConfig = useMemo(() => SESSION_VALIDATION_BY_TOKEN[tokenType], [tokenType]);

  const [isValidating, setIsValidating] = useState(false);
  const [isValidated, setIsValidated] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [validationAttempt, setValidationAttempt] = useState(0);

  useEffect(() => {
    if (!token) {
      setIsValidating(false);
      setIsValidated(false);
      setValidationError(null);
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
        setValidationError(null);
        return;
      }

      setIsValidating(true);
      setIsValidated(false);
      setValidationError(null);

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
          setValidationError(null);
          router.replace(`${redirectTo}?next=${encodeURIComponent(pathname || "/")}`);
          return;
        }

        setIsValidated(false);
        setValidationError(SESSION_VALIDATION_ERROR);
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
  }, [token, tokenType, validationConfig, pathname, redirectTo, router, validationAttempt]);

  if (!token || isValidating || (!isValidated && !validationError)) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center justify-center px-6 py-10">
        <div className="w-full rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <p className="text-sm font-medium text-slate-600">Checking session...</p>
        </div>
      </main>
    );
  }

  if (validationError) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center justify-center px-6 py-10">
        <section className="w-full rounded-2xl border border-rose-200 bg-rose-50 p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide text-rose-700">Session Validation Failed</p>
          <h1 className="mt-2 text-xl font-semibold text-rose-900">Unable to verify your access</h1>
          <p className="mt-2 text-sm text-rose-800">{validationError}</p>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setValidationAttempt((prev) => prev + 1)}
              className="rounded-lg bg-rose-700 px-4 py-2 text-sm font-medium text-white hover:bg-rose-800"
            >
              Retry session check
            </button>
            <button
              type="button"
              onClick={() => {
                clearAuthToken(tokenType);
                router.replace(redirectTo);
              }}
              className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-rose-700 ring-1 ring-rose-300 hover:bg-rose-100"
            >
              Go to sign in
            </button>
          </div>
        </section>
      </main>
    );
  }

  return <>{children}</>;
}
