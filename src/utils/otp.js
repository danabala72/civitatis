export function maskOtp(otp) {
  if (!otp) return "";
  return "*".repeat(Math.max(0, otp.length - 2)) + otp.slice(-2);
}