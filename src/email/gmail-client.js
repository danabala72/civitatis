import { google } from "googleapis";

export class GmailClient {
  constructor(config) {
    const auth = new google.auth.OAuth2(
      config.gmail.clientId,
      config.gmail.clientSecret
    );

    auth.setCredentials({
      refresh_token: config.gmail.refreshToken,
    });

    this.gmail = google.gmail({
      version: "v1",
      auth,
    });

    this.user = config.gmail.user;

    this.otpFrom =
      config.gmail.otpFrom ||
      "clientes@civitatis.com";

    this.otpSubject =
      config.gmail.otpSubject ||
      "verify your identity";
  }

  async getLatestOtpEmail({ after }) {
    const query = this.buildQuery(after);

    console.log("[Gmail] Searching OTP email...");
    console.log("[Gmail] Query:", query);

    const response =
      await this.gmail.users.messages.list({
        userId: this.user,
        q: query,
        maxResults: 10,
      });

    const messages =
      response.data.messages || [];

    if (!messages.length) {
      return null;
    }

    /*
     * Gmail mengembalikan message terbaru
     * terlebih dahulu, tetapi kita tetap
     * membandingkan internalDate.
     */

    const emails = [];

    for (const message of messages) {
      const email =
        await this.getMessage(message.id);

      if (!email) {
        continue;
      }

      if (
        email.from
          .toLowerCase()
          .includes(this.otpFrom.toLowerCase())
      ) {
        emails.push(email);
      }
    }

    if (!emails.length) {
      return null;
    }

    emails.sort(
      (a, b) =>
        b.internalDate - a.internalDate
    );

    return emails[0];
  }

  buildQuery(after) {
    const afterSeconds =
      Math.floor(after / 1000);

    return [
      "in:anywhere",
      `from:${this.otpFrom}`,
      `subject:"${this.otpSubject}"`,
      `after:${afterSeconds}`,
    ].join(" ");
  }

  async getMessage(messageId) {
    const response =
      await this.gmail.users.messages.get({
        userId: this.user,
        id: messageId,
        format: "full",
      });

    const message = response.data;

    return {
      id: message.id,

      threadId:
        message.threadId || null,

      internalDate:
        Number(message.internalDate || 0),

      subject: this.getHeader(
        message.payload?.headers,
        "Subject"
      ),

      from: this.getHeader(
        message.payload?.headers,
        "From"
      ),

      text: this.extractText(
        message.payload
      ),
    };
  }

  getHeader(headers = [], name) {
    return (
      headers.find(
        (header) =>
          header.name.toLowerCase() ===
          name.toLowerCase()
      )?.value || ""
    );
  }

  extractText(payload) {
    if (!payload) {
      return "";
    }

    if (payload.body?.data) {
      return this.decodeBase64Url(
        payload.body.data
      );
    }

    if (payload.parts?.length) {
      return payload.parts
        .map((part) =>
          this.extractText(part)
        )
        .join("\n");
    }

    return "";
  }

  decodeBase64Url(data) {
    return Buffer.from(
      data
        .replace(/-/g, "+")
        .replace(/_/g, "/"),
      "base64"
    ).toString("utf8");
  }
}