"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, TextField } from "@/components/ui/form-controls";
import { ApiError } from "@/lib/api/client";
import { adminLogin, adminMe } from "@/lib/api/admin-auth";
import { setAuthToken } from "@/lib/auth/tokens";

export default function Page() {
  return (
    <Suspense fallback={<LoginPageLoading />}>
      <LoginPageContent />
    </Suspense>
  );
}

function LoginPageContent() {
  const router = useRouter();
  const nextPath = "/admin";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function checkExistingSession() {
      try {
        await adminMe();
        if (active) {
          router.replace(nextPath);
        }
      } catch {
        // ignore, user needs to login
      } finally {
        if (active) {
          setCheckingSession(false);
        }
      }
    }

    void checkExistingSession();

    return () => {
      active = false;
    };
  }, [nextPath, router]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    if (!username.trim() || !password.trim()) {
      setErrorMessage("ต้องระบุชื่อผู้ใช้และรหัสผ่าน");
      return;
    }

    setSubmitting(true);

    try {
      const result = await adminLogin({
        username: username.trim(),
        password,
      });

      setAuthToken("admin", result.sessionToken);
      router.push(nextPath);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("เข้าสู่ระบบไม่สำเร็จ");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (checkingSession) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center justify-center px-6 py-10">
        <div className="w-full rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <p className="text-sm font-medium text-slate-600">
            กำลังตรวจสอบเซสชันผู้ดูแลระบบ...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 px-6 py-10 md:px-10">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-600">
          Phase 5 - Admin Core
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">
          เข้าสู่ระบบผู้ดูแลระบบ
        </h1>
        <p className="mt-3 text-slate-700">
          เข้าสู่ระบบด้วยข้อมูลประจำตัวผู้ดูแลระบบเพื่อเข้าถึงแดชบอร์ดและจัดการคำขอ
        </p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <TextField
            id="username"
            label="ชื่อผู้ใช้"
            required
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            maxLength={120}
            autoComplete="username"
          />

          <TextField
            id="password"
            label="รหัสผ่าน"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            maxLength={200}
            autoComplete="current-password"
          />

          <Button type="submit" disabled={submitting}>
            {submitting ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
          </Button>
        </form>
      </section>

      {errorMessage ? (
        <section className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {errorMessage}
        </section>
      ) : null}

      <Link
        href="/"
        className="text-sm font-medium text-slate-700 underline underline-offset-4"
      >
        กลับสู่หน้าแรก
      </Link>
    </main>
  );
}

function LoginPageLoading() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center justify-center px-6 py-10">
      <div className="w-full rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <p className="text-sm font-medium text-slate-600">
          กำลังโหลดหน้าเข้าสู่ระบบ...
        </p>
      </div>
    </main>
  );
}

