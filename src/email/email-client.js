export class EmailClient {
  async getLatestOtpEmail() {
    throw new Error(
      "getLatestOtpEmail() must be implemented by an email client."
    );
  }
}