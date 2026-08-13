import { config } from "./config.js";

import { BrowserManager } from "./browser/browser-manager.js";
import { CivitatisProvider } from "./civitatis/civitatis-provider.js";
import { SessionManager } from "./session/session-manager.js";

import { GmailClient } from "./email/gmail-client.js";
import { OtpService } from "./email/otp-service.js";
import { NormalizeReservationService } from "./services/normalize-reservation-service.js";
import { ReservationService } from "./services/reservation-service.js";

async function main() {
  const browser = new BrowserManager(config);
  let reservationService;
  try {
    const page = await browser.start();

    const gmailClient = new GmailClient(config);

    const otpService = new OtpService({
      emailClient: gmailClient,
      config,
    });

    const provider = new CivitatisProvider({
      page,
      config,
      otpService,
    });

    const sessionManager = new SessionManager({
      page,
      provider,
    });

    const authenticated =
      await sessionManager.check();

    if (!authenticated) {
      await provider.login();
    }

    console.log("[App] Browser is ready.");

    // =========================
    // PARSE BOOKING LIST
    // =========================

    const bookings =
      await provider.getBookings();

    await browser.stop();

    console.log(
      `[App] Browser closed. ${bookings.length} bookings parsed.`
    );

    if (!bookings.length) {
      console.warn("[App] No bookings found. Nothing to upsert.");
      process.exitCode = 0;
      return;
    }

    const normalizer =
      new NormalizeReservationService();

    reservationService =
      new ReservationService();

    const reservations =
      bookings.map(
        booking =>
          normalizer.normalizeCivitatis(
            booking
          )
      );

    console.log(
      `[App] Normalized ${reservations.length} reservations.`
    );

    const results =
      await reservationService.upsertMany(
        reservations,
        "CIVITATIS"
      );

    const created = results.filter(r => r.action === "CREATED").length;
    const updated = results.filter(r => r.action === "UPDATED").length;
    const failed = results.filter(r => r.action === "FAILED").length;

    console.log(
      `[App] Upsert complete. created=${created} updated=${updated} failed=${failed}`
    );

    for (const res of results) {
      if (res.action === "FAILED") {
        console.error(
          `[App] Failed supplier_booking_id=${res.supplier_booking_id}:`,
          res.error
        );
      }
    }

  } catch (error) {
    console.error(
      "[App] Error:",
      error
    );

    process.exitCode = 1;
  } finally {
    if (reservationService) {
      await reservationService.close();
    }
  }
}

main();