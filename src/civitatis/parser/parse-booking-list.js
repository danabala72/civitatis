import { sleep } from "../../utils/sleep.js";

export async function parseBookingList(page) {
  console.log("[Civitatis] Parsing booking list...");

  const result = [];

  /*
   * =====================================================
   * DATE COUNT
   * =====================================================
   */

  const total = await page.$$eval(
    "ul.accordion > li.accordion-item",
    items => items.length
  );

  /*
   * Hanya proses 2 tanggal terdekat.
   */
  const dateCount = Math.min(total, 2);

  console.log(
    `[Civitatis] Found ${total} dates. Processing ${dateCount} nearest dates.`
  );

  /*
   * =====================================================
   * LOOP DATES
   * =====================================================
   */

  for (
    let dateIndex = 0;
    dateIndex < dateCount;
    dateIndex++
  ) {
    /*
     * DOM berubah setelah service diklik.
     * Karena itu selalu ambil ulang date item.
     */

    const dateItem = await getDateItem(
      page,
      dateIndex
    );

    if (!dateItem) {
      console.log(
        `[Civitatis] Date ${dateIndex + 1} not found.`
      );

      continue;
    }

    const date = await getDate(
      dateItem
    );

    console.log(
      `\n[Civitatis] Date ${dateIndex + 1}/${dateCount}: ${date}`
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

    const initialServiceRows =
      await getServiceRows(
        dateItem
      );

    const serviceCount =
      initialServiceRows.length;

    console.log(
      `[Civitatis] Found ${serviceCount} services.`
    );

    const services = [];

    /*
     * ===================================================
     * LOOP SERVICES
     * ===================================================
     */

    for (
      let serviceIndex = 0;
      serviceIndex < serviceCount;
      serviceIndex++
    ) {
      /*
       * Ambil date item terbaru.
       */
      const currentDateItem =
        await getDateItem(
          page,
          dateIndex
        );

      if (!currentDateItem) {
        console.log(
          `[Civitatis] Date item disappeared.`
        );

        continue;
      }

      /*
       * Ambil service rows terbaru.
       */
      const serviceRows =
        await getServiceRows(
          currentDateItem
        );

      const serviceRow =
        serviceRows[serviceIndex];

      if (!serviceRow) {
        console.log(
          `[Civitatis] Service ${serviceIndex + 1} not found.`
        );

        continue;
      }

      /*
       * =================================================
       * SERVICE DATA
       * =================================================
       */

      const service =
        await getText(
          serviceRow,
          "td.__product"
        );

      const time =
        await getText(
          serviceRow,
          "td.__date"
        );

      const bookingCount =
        await getText(
          serviceRow,
          "td.__bookings"
        );

      console.log(
        `[Civitatis] Service ${serviceIndex + 1}/${serviceCount}: ${service}`
      );

      /*
       * =================================================
       * CHECK EXPANDED
       * =================================================
       */

      const expanded =
        await serviceRow.evaluate(
          row =>
            row.classList.contains(
              "_clicked-tr"
            )
        );

      /*
       * =================================================
       * CLICK SERVICE
       * =================================================
       */

      if (!expanded) {
        console.log(
          "[Civitatis] Clicking service..."
        );

        try {
          await serviceRow.click();

          /*
           * Civitatis melakukan loading/request
           * setelah service diklik.
           */
          await sleep(2000);
        } catch (error) {
          console.log(
            `[Civitatis] Failed to click service: ${error.message}`
          );

          services.push({
            index: serviceIndex,
            time,
            service,
            bookingCount,
            bookings: [],
          });

          continue;
        }
      }

      /*
       * =================================================
       * WAIT CHILD TABLE
       * =================================================
       */

      const childReady =
        await waitForChildTable(
          serviceRow
        );

      if (!childReady) {
        console.log(
          "[Civitatis] Child table not available."
        );

        services.push({
          index: serviceIndex,
          time,
          service,
          bookingCount,
          bookings: [],
        });

        continue;
      }

      /*
       * =================================================
       * GET BOOKINGS
       * =================================================
       */

      const bookings =
        await getBookingLinks(
          serviceRow
        );

      console.log(
        `[Civitatis] Found ${bookings.length} bookings.`
      );

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

  console.log(
    "\n[Civitatis] Booking list parsing completed."
  );

  return result;
}


/*
 * =====================================================
 * GET DATE ITEM
 * =====================================================
 */

async function getDateItem(
  page,
  index
) {
  const items =
    await page.$$(
      "ul.accordion > li.accordion-item"
    );

  return items[index] || null;
}


/*
 * =====================================================
 * GET DATE
 * =====================================================
 */

async function getDate(
  dateItem
) {
  return await getText(
    dateItem,
    ".nextJobsRowDate .list-item-title span"
  );
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

async function getServiceRows(
  dateItem
) {
  const rows =
    await dateItem.$$(
      "table._next-jobs-table_parent tbody > tr[role='row']"
    );

  const serviceRows = [];

  for (const row of rows) {
    const product =
      await row.$(
        "td.__product"
      );

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

async function getText(
  element,
  selector
) {
  try {
    return await element.$eval(
      selector,
      el =>
        el.textContent
          .trim()
          .replace(/\s+/g, " ")
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

async function waitForChildTable(
  serviceRow,
  timeout = 15000
) {
  const startedAt =
    Date.now();

  while (
    Date.now() - startedAt <
    timeout
  ) {
    const exists =
      await serviceRow.evaluate(
        row => {
          const child =
            row.nextElementSibling;

          if (!child) {
            return false;
          }

          return Boolean(
            child.querySelector(
              "table._next-jobs-table_child"
            )
          );
        }
      );

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

async function getBookingLinks(
  serviceRow
) {
  const child =
    await serviceRow.evaluateHandle(
      row =>
        row.nextElementSibling
    );

  try {
    const childElement =
      child.asElement();

    if (!childElement) {
      return [];
    }

    /*
     * Ambil booking rows.
     */
    const rows =
      await childElement.$$(
        'table._next-jobs-table_child tbody > tr[role="row"]'
      );

    const bookings = [];

    for (const row of rows) {
      /*
       * Ambil SATU link dari booking row.
       */
      const link =
        await row.$(
          'a.js-row-link[href*="/providers/v2/bookings/activity/book"]'
        );

      if (!link) {
        continue;
      }

      const booking =
        await row.evaluate(
          row => {
            const link =
              row.querySelector(
                'a.js-row-link[href*="/providers/v2/bookings/activity/book"]'
              );

            return {
              id:
                row
                  .querySelector(
                    "td.__id"
                  )
                  ?.textContent
                  ?.trim() || null,

              traveler:
                row
                  .querySelector(
                    "td.__traveler"
                  )
                  ?.textContent
                  ?.trim() || null,

              href:
                link?.href || null,
            };
          }
        );

      if (!booking.href) {
        continue;
      }

      bookings.push(
        booking
      );
    }

    return bookings;
  } finally {
    await child.dispose();
  }
}
