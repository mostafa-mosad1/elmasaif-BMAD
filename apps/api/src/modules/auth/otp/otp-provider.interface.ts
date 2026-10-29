export const OTP_PROVIDER_TOKEN = 'OTP_PROVIDER_TOKEN';

export interface OtpProvider {
  /**
   * Send 6-digit OTP code to the given E.164 normalized mobile number.
   * Returns true on successful dispatch.
   */
  sendOtp(mobileNumber: string, code: string): Promise<boolean>;
}
