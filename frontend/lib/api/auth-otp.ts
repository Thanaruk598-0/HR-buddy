import { apiFetch } from "@/lib/api/client";

export type SendOtpPayload = {
  phone: string;
  email: string;
};

export type SendOtpResponse = {
  expiresAt: string;
  devOtp?: string;
};

export type VerifyOtpPayload = {
  phone: string;
  email: string;
  otpCode: string;
};

export type VerifyOtpResponse = {
  sessionToken: string;
  expiresAt: string;
};

export async function sendOtp(payload: SendOtpPayload) {
  return apiFetch<SendOtpResponse>("/auth-otp/send", {
    method: "POST",
    body: payload,
  });
}

export async function verifyOtp(payload: VerifyOtpPayload) {
  return apiFetch<VerifyOtpResponse>("/auth-otp/verify", {
    method: "POST",
    body: payload,
  });
}
