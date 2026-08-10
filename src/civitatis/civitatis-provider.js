export class CivitatisProvider {
  constructor({ page, config, otpService }) {
    this.page = page;
    this.config = config;
    this.otpService = otpService;
  }

  async open() {
    console.log("[Civitatis] Opening provider...");

    await this.page.goto(
      this.config.civitatis.bookingsUrl,
      {
        waitUntil: "domcontentloaded",
      }
    );

    console.log(
      "[Civitatis] URL:",
      this.page.url()
    );
  }

  async login() {
    console.log("[Civitatis] Login...");

    await this.page.waitForSelector(
      "#user-login",
      { timeout: 10000 }
    );

    await this.page.type(
      "#login-name",
      this.config.civitatis.username
    );

    await this.page.type(
      "#login-password",
      this.config.civitatis.password
    );

    const loginStartedAt = Date.now();

    await this.page.click(
      'button[data-testid="button_login"]'
    );

    await this.page.waitForSelector(
      "#auth-code-verification-modal",
      { timeout: 15000 }
    );

    console.log(
      "[Civitatis] OTP required."
    );

    const otp =
      await this.otpService.getOtp({
        after: loginStartedAt,
      });

    await this.enterOtp(otp);
  }
 
  async isOtpRequired() {
    return Boolean(
      await this.page.$("#auth-code-verification-modal")
    );
  }

  async enterOtp(otp) {
    const inputs = await this.page.$$(
      "#auth-code-verification-modal .code-verification-inputs input"
    );

    if (inputs.length !== 5) {
      throw new Error(
        `Expected 5 OTP inputs, found ${inputs.length}`
      );
    }

    if (!/^[A-Za-z0-9]{5}$/.test(otp)) {
      throw new Error(
        "OTP must contain exactly 5 alphanumeric characters."
      );
    }

    console.log(
      `[Civitatis] Entering OTP: ${otp}`
    );

    for (let i = 0; i < inputs.length; i++) {
      await inputs[i].type(otp[i]);
    }

    console.log("[Civitatis] OTP entered.");
  }
}