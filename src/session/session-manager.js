export class SessionManager {
  constructor({ page, provider }) {
    this.page = page;
    this.provider = provider;
  }

  async check() {
    console.log("[Session] Checking session...");

    await this.provider.open();

    const loginModal = await this.page.$("#user-login");

    if (loginModal) {
      console.log("[Session] Session is NOT valid.");
      return false;
    }

    console.log("[Session] Session is valid.");
    return true;
  }
}