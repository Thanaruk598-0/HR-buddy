"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ApiError } from "@/lib/api/client";
import { sendOtp, verifyOtp } from "@/lib/api/auth-otp";
import { setAuthToken } from "@/lib/auth/tokens";
import { getEmployeeContact, setEmployeeContact } from "@/lib/auth/employee-contact";
import { Button, TextField } from "@/components/ui/form-controls";

type Stage = "idle" | "code-sent";

export default function Page() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextRaw = searchParams.get("next") || "/my-requests";
  const nextPath = nextRaw.startsWith("/") ? nextRaw : "/my-requests";

  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");

  const [stage, setStage] = useState<Stage>("idle");
  const [submittingSend, setSubmittingSend] = useState(false);
  const [submittingVerify, setSubmittingVerify] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [otpHint, setOtpHint] = useState<string | null>(null);

  useEffect(() => {
    const saved = getEmployeeContact();
    if (saved) {
      setPhone(saved.phone || "");
      setEmail(saved.email || "");
    }
  }, []);

  const canSend = useMemo(() => {
    return /^\+?\d{9,15}$/.test(phone.trim()) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  }, [phone, email]);

  const canVerify = useMemo(() => {
    return /^\d{6}$/.test(otpCode.trim()) && canSend;
  }, [otpCode, canSend]);

  const handleSendOtp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setOtpHint(null);

    if (!canSend) {
      setErrorMessage("Please provide valid phone and email before requesting OTP.");
      return;
    }

    setSubmittingSend(true);

    try {
      const result = await sendOtp({
        phone: phone.trim(),
        email: email.trim(),
      });

      setStage("code-sent");
      if (result.devOtp) {
        setOtpHint(`DEV OTP: ${result.devOtp}`);
      }
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Failed to send OTP");
      }
    } finally {
      setSubmittingSend(false);
    }
  };

  const handleVerifyOtp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    if (!canVerify) {
      setErrorMessage("OTP code must be 6 digits.");
      return;
    }

    setSubmittingVerify(true);

    try {
      const result = await verifyOtp({
        phone: phone.trim(),
        email: email.trim(),
        otpCode: otpCode.trim(),
      });

      setAuthToken("employee", result.sessionToken);
      setEmployeeContact({ phone: phone.trim(), email: email.trim() });

      router.push(nextPath);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Failed to verify OTP");
      }
    } finally {
      setSubmittingVerify(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 px-6 py-10 md:px-10">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-600">Phase 3 - OTP and Tracking</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">OTP Verification</h1>
        <p className="mt-3 text-slate-700">Verify phone and email to access My Requests.</p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <form className="space-y-4" onSubmit={handleSendOtp}>
          <TextField
            id="phone"
            label="Phone"
            required
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="+66812345678"
            maxLength={15}
          />

          <TextField
            id="email"
            label="Email"
            required
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@company.com"
            maxLength={120}
          />

          <Button type="submit" disabled={submittingSend || !canSend}>
            {submittingSend ? "Sending OTP..." : stage === "code-sent" ? "Resend OTP" : "Send OTP"}
          </Button>
        </form>
      </section>

      {stage === "code-sent" ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <form className="space-y-4" onSubmit={handleVerifyOtp}>
            <TextField
              id="otpCode"
              label="OTP Code"
              required
              value={otpCode}
              onChange={(event) => setOtpCode(event.target.value)}
              placeholder="6-digit code"
              maxLength={6}
            />

            <Button type="submit" disabled={submittingVerify || !canVerify}>
              {submittingVerify ? "Verifying..." : "Verify and Continue"}
            </Button>
          </form>
        </section>
      ) : null}

      {otpHint ? (
        <section className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          {otpHint}
        </section>
      ) : null}

      {errorMessage ? (
        <section className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {errorMessage}
        </section>
      ) : null}

      <Link href="/" className="text-sm font-medium text-slate-700 underline underline-offset-4">
        Back to Home
      </Link>
    </main>
  );
}
