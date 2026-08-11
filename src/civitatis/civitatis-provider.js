import { sleep } from "../utils/sleep.js";
import { parseBookingDetail } from "./parser/parse-booking-detail.js";
import { parseBookingList } from "./parser/parse-booking-list.js";

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

    /*
     * Kalau session masih aktif, halaman login
     * mungkin tidak muncul.
     */
    const loginForm = await this.page.$("#user-login");

    if (!loginForm) {
      console.log(
        "[Civitatis] Login form not found. Session may still be active."
      );

      await this.closeActivePopup();

      console.log(
        "[Civitatis] Login flow completed."
      );

      return;
    }

    await this.page.waitForSelector(
      "#login-name",
      {
        visible: true,
        timeout: 10000,
      }
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

    /*
     * OTP hanya muncul jika Civitatis meminta
     * verifikasi tambahan.
     */
    const otpRequired =
      await this.waitForOtpModal(5000);

    if (otpRequired) {
      console.log(
        "[Civitatis] OTP required."
      );

      const otp =
        await this.otpService.getOtp({
          after: loginStartedAt,
        });

      if (!otp) {
        throw new Error(
          "[Civitatis] OTP not received."
        );
      }

      await this.enterOtp(otp);

      /*
       * Tunggu OTP selesai diproses.
       *
       * Biasanya setelah karakter terakhir:
       * OTP modal akan ditutup dan halaman
       * melanjutkan proses login.
       */
      await this.waitForOtpModalClosed();

      /*
       * Setelah OTP berhasil, Civitatis dapat
       * menampilkan informational popup.
       */
      await this.closeActivePopup({
        waitForPopup: true,
        timeout: 5000,
      });
    } else {
      console.log(
        "[Civitatis] OTP not required. Existing session or login completed directly."
      );

      /*
       * Jangan menunggu popup terlalu lama pada
       * existing session.
       *
       * Kalau popup memang sudah ada, tutup.
       * Kalau tidak ada, langsung lanjut.
       */
      await this.closeActivePopup();
    }

    console.log(
      "[Civitatis] Login flow completed."
    );
  }

  /**
   * Menunggu OTP modal muncul.
   */
  async waitForOtpModal(timeout = 5000) {
    try {
      await this.page.waitForSelector(
        "#auth-code-verification-modal",
        {
          visible: true,
          timeout,
        }
      );

      console.log(
        "[Civitatis] OTP modal detected."
      );

      return true;
    } catch (error) {
      if (error.name === "TimeoutError") {
        return false;
      }

      throw error;
    }
  }

  /**
   * Menunggu OTP modal hilang setelah OTP
   * selesai diproses.
   */
  async waitForOtpModalClosed(timeout = 10000) {
    try {
      await this.page.waitForSelector(
        "#auth-code-verification-modal",
        {
          hidden: true,
          timeout,
        }
      );

      console.log(
        "[Civitatis] OTP modal closed."
      );

      return true;
    } catch (error) {
      if (error.name === "TimeoutError") {
        /*
         * Cek sekali lagi apakah modal masih visible.
         */
        const modal =
          await this.page.$(
            "#auth-code-verification-modal"
          );

        if (!modal) {
          console.log(
            "[Civitatis] OTP modal removed from DOM."
          );

          return true;
        }

        const visible =
          await modal.isIntersectingViewport();

        if (!visible) {
          console.log(
            "[Civitatis] OTP modal is no longer visible."
          );

          return true;
        }

        throw new Error(
          "[Civitatis] OTP modal did not close after OTP was entered."
        );
      }

      throw error;
    }
  }

  async isOtpRequired() {
    const modal =
      await this.page.$(
        "#auth-code-verification-modal"
      );

    if (!modal) {
      return false;
    }

    return await modal.isIntersectingViewport();
  }

  async enterOtp(otp) {
    const inputs =
      await this.page.$$(
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
      "[Civitatis] Entering OTP..."
    );

    for (let i = 0; i < inputs.length; i++) {
      await inputs[i].type(otp[i]);
    }

    console.log(
      "[Civitatis] OTP entered."
    );
  }

  /**
   * Menutup informational popup.
   *
   * Popup HTML:
   *
   * <div class="popupbox-content">
   *   <button>
   *     <i class="a-icon--close"></i>
   *   </button>
   *   ...
   * </div>
   *
   * Kita tidak menggunakan :has()
   * supaya kompatibel dengan berbagai versi
   * Puppeteer / Chromium.
   */
  async closeActivePopup({
    waitForPopup = false,
    timeout = 3000,
  } = {}) {
    try {
      let popup = null;

      /*
       * Setelah OTP:
       * tunggu popup sebentar karena popup baru
       * muncul setelah proses login selesai.
       */
      if (waitForPopup) {
        try {
          await this.page.waitForSelector(
            ".popupbox.is-active .popupbox-content",
            {
              visible: true,
              timeout,
            }
          );

          popup =
            await this.page.$(
              ".popupbox.is-active .popupbox-content"
            );
        } catch (error) {
          if (error.name === "TimeoutError") {
            console.log(
              "[Civitatis] No informational popup."
            );

            return false;
          }

          throw error;
        }
      } else {
        /*
         * Existing session:
         * jangan menunggu popup.
         *
         * Cukup cek apakah popup aktif sekarang.
         */
        popup =
          await this.page.$(
            ".popupbox.is-active .popupbox-content"
          );

        if (!popup) {
          console.log(
            "[Civitatis] No active popup."
          );

          return false;
        }
      }

      if (!popup) {
        console.log(
          "[Civitatis] No active popup."
        );

        return false;
      }

      console.log(
        "[Civitatis] Informational popup detected."
      );

      /*
       * HTML popup yang diberikan user:
       *
       * <button class="...">
       *   <i class="a-icon--close"></i>
       * </button>
       *
       * Ambil button yang berada DI DALAM popup.
       *
       * Tidak menggunakan :has().
       */
      const closeButton =
        await popup.$("button");

      if (!closeButton) {
        console.log(
          "[Civitatis] Popup found but close button not found."
        );

        return false;
      }

      console.log(
        "[Civitatis] Clicking popup close button..."
      );

      await closeButton.click();

      /*
       * Tunggu popup benar-benar hilang.
       */
      try {
        await this.page.waitForSelector(
          ".popupbox.is-active .popupbox-content",
          {
            hidden: true,
            timeout: 3000,
          }
        );

        console.log(
          "[Civitatis] Popup closed."
        );
      } catch (error) {
        if (error.name === "TimeoutError") {
          /*
           * Bisa saja popup sudah ditutup tetapi
           * class / DOM belum berubah karena animasi.
           */
          console.log(
            "[Civitatis] Popup close animation still active."
          );

          return true;
        }

        throw error;
      }

      return true;
    } catch (error) {
      if (error.name === "TimeoutError") {
        console.log(
          "[Civitatis] Popup timeout. Continuing..."
        );

        return false;
      }

      throw error;
    }
  }

  async getBookings() {
    console.log(
      "[Civitatis] Getting bookings..."
    );

    /*
    * Pastikan booking list sudah berada
    * di halaman yang benar.
    */
    if (
      this.page.url() !==
      this.config.civitatis.bookingsUrl
    ) {
      await this.page.goto(
        this.config.civitatis.bookingsUrl,
        {
          waitUntil: "domcontentloaded",
        }
      );
    }

    await this.page.waitForSelector(
      "table._next-jobs-table_parent",
      {
        visible: true,
        timeout: 15000,
      }
    );

    /*
    * Tahap 1:
    * Ambil list booking.
    */
    const bookingList =
      await parseBookingList(
        this.page
      );

    const result = [];

    /*
    * Tahap 2:
    * Buka detail masing-masing booking.
    */
    for (const date of bookingList) {
      for (const service of date.services) {
        for (const booking of service.bookings) {
          console.log(
            `[Civitatis] Opening booking ${booking.id}...`
          );

          const detailPage =
            await this.page
              .browser()
              .newPage();

          try {
            await detailPage.goto(
              booking.href,
              {
                waitUntil:
                  "domcontentloaded",
              }
            );

            /*
            * Tunggu Reservation details.
            */
            await detailPage.waitForSelector(
              "ul.myaccount-data > li.myaccount-data__item",
              {
                visible: true,
                timeout: 15000,
              }
            );

            const delay = 2000 + Math.floor(Math.random() * 1001);
            
            await sleep(delay)

            const detail =
              await parseBookingDetail(
                detailPage,
                booking.id
              );

            result.push({
              date: date.date,

              service: service.service,

              booking: {
                id: booking.id,
                traveler:
                  booking.traveler,
                href: booking.href,
              },

              detail,
            });
          } catch (error) {
            console.error(
              `[Civitatis] Failed booking ${booking.id}:`,
              error.message
            );

            result.push({
              date: date.date,

              service: service.service,

              booking: {
                id: booking.id,
                traveler:
                  booking.traveler,
                href: booking.href,
              },

              detail: null,

              error: error.message,
            });
          } finally {
            await detailPage.close();
          }
        }
      }
    }

    return result;
  }
}