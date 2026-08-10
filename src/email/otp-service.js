export class OtpService {
  constructor({ emailClient, config }) {
    this.emailClient = emailClient;
    this.config = config;
  }

  async getOtp({ after }) {
    const timeoutAt =
      Date.now() + this.config.otp.timeoutMs;

    console.log(
      "[OTP] Waiting for Civitatis verification email..."
    );

    while (Date.now() < timeoutAt) {
      const email =
        await this.emailClient.getLatestOtpEmail({
          after,
        });

      if (email) {
        console.log(
          "[OTP] Email found:",
          email.subject
        );

        const otp =
          this.extractOtp(email.text);

        if (otp) {
          console.log(
            "[OTP] Code found:",
            otp
          );

          return otp;
        }
      }

      await this.sleep(
        this.config.otp.pollIntervalMs
      );
    }

    throw new Error(
      "[OTP] Timeout waiting for Civitatis OTP."
    );
  }

  extractOtp(text) {
    /*
     * Berdasarkan format email Civitatis:
     *
     * This code will expire in 15 minutes.
     *
     * Lfrxq
     *
     * Cari kode setelah kalimat tersebut.
     */

    const match = text.match(
      /This code will expire in 15 minutes\.\s*([A-Za-z0-9]{5})/i
    );

    if (!match) {
      return null;
    }

    return match[1];
  }

  sleep(ms) {
    return new Promise((resolve) =>
      setTimeout(resolve, ms)
    );
  }
}