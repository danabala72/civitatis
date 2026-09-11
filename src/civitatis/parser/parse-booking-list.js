import { dismissDashboardNotice } from "./parse-booking-detail.js";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat.js";

import { sleep } from "../../utils/sleep.js";

dayjs.extend(customParseFormat);

export async function parseBookingList(page) {
  console.log("[Civitatis] Parsing booking list...");

  await dismissDashboardNotice(page);

  const result = [];

  /*
   * =====================================================
   * DATE COUNT
   * =====================================================
   *
   * Hanya proses 2 tanggal future terdekat.
   *
   * Contoh hari ini:
   * August 12, 2026
   *
   * 12 -> skip
   * 13 -> process
   * 14 -> process
   */

  await page.waitForSelector("ul.accordion > li.accordion-item", {
    timeout: 15000,
  });

  const total = await page.$$eval(
    "ul.accordion > li.accordion-item",
    (items) => items.length,
  );

  const today = dayjs().startOf("day");

  const nearestDates = [];

  for (let index = 0; index < total; index++) {
    const dateItem = await getDateItem(page, index);

    if (!dateItem) {
      continue;
    }

    const dateText = await getDate(dateItem);

    const date = parseCivitatisDate(dateText);

    if (!date) {
      console.log(`[Civitatis] Invalid date: ${dateText}`);

      continue;
    }

    /*
     * Jangan ambil hari ini
     * atau tanggal yang sudah lewat.
     */
    if (date.isSame(today, "day") || date.isBefore(today, "day")) {
      continue;
    }

    nearestDates.push({
      index,
      dateText,
    });

    /*
     * Cukup 2 tanggal future
     */
    if (nearestDates.length === 2) {
      break;
    }
  }

  console.log(
    `[Civitatis] Found ${total} dates. Processing ${nearestDates.length} nearest future dates.`,
  );

  /*
   * =====================================================
   * LOOP DATES
   * =====================================================
   */

  for (let dateIndex = 0; dateIndex < nearestDates.length; dateIndex++) {
    const targetDate = nearestDates[dateIndex];

    /*
     * DOM bisa berubah setelah service diklik.
     *
     * Karena itu kita SELALU mengambil ulang
     * date item menggunakan index asli.
     */
    const dateItem = await getDateItem(page, targetDate.index);

    if (!dateItem) {
      console.log(`[Civitatis] Date ${targetDate.index + 1} not found.`);

      continue;
    }

    const date = targetDate.dateText;

    console.log(
      `\n[Civitatis] Date ${dateIndex + 1}/${nearestDates.length}: ${date}`,
    );

    /*
     * ===================================================
     * SERVICE COUNT
     * ===================================================
     *
     * Hanya tr yang memiliki td.__product
     * dianggap sebagai service.
     *
     * Child row diabaikan.
     */

    const initialServiceRows = await getServiceRows(dateItem);

    const serviceCount = initialServiceRows.length;

    console.log(`[Civitatis] Found ${serviceCount} services.`);

    const services = [];

    /*
     * ===================================================
     * LOOP SERVICES
     * ===================================================
     */

    for (let serviceIndex = 0; serviceIndex < serviceCount; serviceIndex++) {
      /*
       * Ambil date item terbaru.
       */
      const currentDateItem = await getDateItem(page, targetDate.index);

      if (!currentDateItem) {
        console.log(`[Civitatis] Date item disappeared.`);

        continue;
      }

      /*
       * Ambil service rows terbaru.
       */
      const serviceRows = await getServiceRows(currentDateItem);

      const serviceRow = serviceRows[serviceIndex];

      if (!serviceRow) {
        console.log(`[Civitatis] Service ${serviceIndex + 1} not found.`);

        continue;
      }

      /*
       * =================================================
       * SERVICE DATA
       * =================================================
       */

      const service = await getText(serviceRow, "td.__product");

      const time = await getText(serviceRow, "td.__date");

      const bookingCount = await getText(serviceRow, "td.__bookings");

      console.log(
        `[Civitatis] Service ${serviceIndex + 1}/${serviceCount}: ${service}`,
      );

      /*
       * =================================================
       * CHECK EXPANDED
       * =================================================
       */

      const expected = Number(bookingCount.replace(/[^0-9]/g, ""));
      let bookings = [];
      for (let attempt = 1; attempt <= 2; attempt++) {
        await dismissDashboardNotice(page);
        const dateHandle = await getDateItem(page, targetDate.index);
        const row = (await getServiceRows(dateHandle))[serviceIndex];
        if (!row) throw new Error(`Service row missing: ${service}`);
        const expanded = await row.evaluate(el => el.classList.contains("_clicked-tr"));
        if (!expanded) await row.click();
        const started = Date.now();
        while (Date.now() - started < 15000) {
          const freshDate = await getDateItem(page, targetDate.index);
          const freshRow = freshDate && (await getServiceRows(freshDate))[serviceIndex];
          if (freshRow) bookings = await getBookingLinks(freshRow);
          if (bookings.length && (!expected || bookings.length === expected)) break;
          await sleep(200);
        }
        if (bookings.length && (!expected || bookings.length === expected)) break;
        console.warn(`[Civitatis] Retry service ${service}: expected=${expected}, found=${bookings.length}`);
        // Reset a stalled expanded row before the next attempt.
        if (attempt < 2) {
          const freshDate = await getDateItem(page, targetDate.index);
          const freshRow = (await getServiceRows(freshDate))[serviceIndex];
          if (freshRow && await freshRow.evaluate(el => el.classList.contains("_clicked-tr"))) {
            await freshRow.click();
          }
        }
      }
      if (!bookings.length || (expected && bookings.length !== expected)) {
        throw new Error(`Incomplete booking list: ${date} / ${service}: expected=${expected}, found=${bookings.length}`);
      }

      console.log(`[Civitatis] Found ${bookings.length} bookings.`);

      services.push({
        index: serviceIndex,
        time,
        service,
        bookingCount,
        bookings,
      });
    }

    /*
     * ===================================================
     * DATE RESULT
     * ===================================================
     */

    result.push({
      date,
      services,
    });
  }

  console.log("\n[Civitatis] Booking list parsing completed.");

  return result;
}

/*
 * =====================================================
 * PARSE CIVITATIS DATE
 * =====================================================
 */

function parseCivitatisDate(value) {
  if (!value) {
    return null;
  }

  const text = value.trim().replace(/^[^,]+,\s*/, "");

  const date = dayjs(text, "MMMM D, YYYY", true);

  if (!date.isValid()) {
    return null;
  }

  return date.startOf("day");
}

/*
 * =====================================================
 * GET DATE ITEM
 * =====================================================
 */

async function getDateItem(page, index) {
  const items = await page.$$("ul.accordion > li.accordion-item");

  return items[index] || null;
}

/*
 * =====================================================
 * GET DATE
 * =====================================================
 */

async function getDate(dateItem) {
  return await getText(dateItem, ".nextJobsRowDate .list-item-title span");
}

/*
 * =====================================================
 * GET SERVICE ROWS
 * =====================================================
 *
 * Parent table dapat memiliki:
 *
 * service row
 * child row
 * service row
 * child row
 *
 * Hanya row yang memiliki td.__product
 * merupakan service.
 */

async function getServiceRows(dateItem) {
  const rows = await dateItem.$$(
    "table._next-jobs-table_parent tbody > tr[role='row']",
  );

  const serviceRows = [];

  for (const row of rows) {
    const product = await row.$("td.__product");

    if (!product) {
      continue;
    }

    serviceRows.push(row);
  }

  return serviceRows;
}

/*
 * =====================================================
 * GET TEXT
 * =====================================================
 */

async function getText(element, selector) {
  try {
    return await element.$eval(selector, (el) =>
      el.textContent.trim().replace(/\s+/g, " "),
    );
  } catch {
    return "";
  }
}

/*
 * =====================================================
 * WAIT CHILD TABLE
 * =====================================================
 */

async function waitForChildTable(serviceRow, timeout = 15000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeout) {
    const exists = await serviceRow.evaluate((row) => {
      const child = row.nextElementSibling;

      if (!child) {
        return false;
      }

      return Boolean(child.querySelector("table._next-jobs-table_child"));
    });

    if (exists) {
      return true;
    }

    await sleep(100);
  }

  return false;
}

/*
 * =====================================================
 * GET BOOKING LINKS
 * =====================================================
 *
 * Satu booking = satu TR.
 *
 * Jangan loop semua a.js-row-link,
 * karena satu booking row memiliki
 * banyak link dengan href yang sama.
 */

async function getBookingLinks(serviceRow) {
  const child = await serviceRow.evaluateHandle(
    (row) => row.nextElementSibling,
  );

  try {
    const childElement = child.asElement();

    if (!childElement) {
      return [];
    }

    /*
     * Ambil booking rows.
     */
    const rows = await childElement.$$(
      'table._next-jobs-table_child tbody > tr[role="row"]',
    );

    const bookings = [];

    for (const row of rows) {
      /*
       * Ambil SATU link dari booking row.
       */
      const link = await row.$(
        'a.js-row-link[href*="/providers/v2/bookings/activity/book"]',
      );

      if (!link) {
        continue;
      }

      const booking = await row.evaluate((row) => {
        const link = row.querySelector(
          'a.js-row-link[href*="/providers/v2/bookings/activity/book"]',
        );

        return {
          id: row.querySelector("td.__id")?.textContent?.trim() || null,

          traveler:
            row.querySelector("td.__traveler")?.textContent?.trim() || null,

          people: (() => {
            const link = row.querySelector("td:nth-child(7) a.js-row-link");
            const source = link || row;
            const text = source.textContent.trim();
            const match = text.match(/(\d+)/);
            return match ? match[1] : null;
          })(),

          href: link?.href || null,
        };
      });

      if (!booking.href) {
        continue;
      }

      bookings.push(booking);
    }

    return bookings;
  } finally {
    await child.dispose();
  }
}

