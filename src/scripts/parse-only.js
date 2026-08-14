import { config } from "../config.js";

import { BrowserManager } from "../browser/browser-manager.js";
import { CivitatisProvider } from "../civitatis/civitatis-provider.js";
import { SessionManager } from "../session/session-manager.js";

import { GmailClient } from "../email/gmail-client.js";
import { OtpService } from "../email/otp-service.js";
import { NormalizeReservationService } from "../services/normalize-reservation-service.js";
import { ReservationService } from "../services/reservation-service.js";

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

    const authenticated = await sessionManager.check();

    if (!authenticated) {
      await provider.login();
    }

    console.log("[ParseOnly] Browser is ready.");

    const bookings = await provider.getBookings();

    await browser.stop();

    console.log(
      `[ParseOnly] Browser closed. ${bookings.length} bookings parsed.`,
    );

    if (!bookings.length) {
      console.warn("[ParseOnly] No bookings found.");
      return;
    }

    const normalizer = new NormalizeReservationService();

    const reservations = bookings.map((booking) =>
      normalizer.normalizeCivitatis(booking),
    );

    console.log(`[ParseOnly] ${reservations.length} reservations normalized.`);

    reservationService = new ReservationService();

    const results = await reservationService.upsertMany(
      reservations,
      "CIVITATIS",
    );

    const created = results.filter((r) => r.action === "CREATED").length;
    const updated = results.filter((r) => r.action === "UPDATED").length;
    const failed = results.filter((r) => r.action === "FAILED").length;

    console.log(
      `[ParseOnly] Upsert complete. created=${created} updated=${updated} failed=${failed}`,
    );

    for (const res of results) {
      if (res.action === "FAILED") {
        console.error(
          `[ParseOnly] Failed supplier_booking_id=${res.supplier_booking_id}:`,
          res.error,
        );
      }
    }
  } catch (error) {
    console.error("[ParseOnly] Error:", error);

    process.exitCode = 1;
  } finally {
    if (reservationService) {
      await reservationService.close();
    }
  }
}

main();
