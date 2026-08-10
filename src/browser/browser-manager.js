import puppeteer from "puppeteer";

export class BrowserManager {
  constructor(config) {
    this.config = config;
    this.browser = null;
    this.page = null;
  }

  async start() {
    this.browser = await puppeteer.launch({
      headless: this.config.browser.headless,

      executablePath:
        this.config.browser.executablePath,

      userDataDir:
        this.config.browser.userDataDir,

      defaultViewport: {
        width: 1440,
        height: 900,
      },

      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
      ],
    });

    const pages = await this.browser.pages();

    this.page =
      pages.length > 0
        ? pages[0]
        : await this.browser.newPage();

    return this.page;
  }

  async stop() {
    if (!this.browser) {
      return;
    }

    await this.browser.close();

    this.browser = null;
    this.page = null;
  }
}