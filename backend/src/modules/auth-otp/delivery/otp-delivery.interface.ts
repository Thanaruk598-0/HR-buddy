export type OtpDeliveryPayload = {
  phone: string;
  email: string;
  otpCode: string;
  expiresAt: Date;
};

export interface OtpDeliveryProvider {
  sendOtp(payload: OtpDeliveryPayload): Promise<void>;
}
