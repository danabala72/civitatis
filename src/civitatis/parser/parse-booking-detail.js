import { ReservationScreenshotService } from "./reservation-screenshot-service.js";

export async function parseBookingDetail(
  page,
  bookingId
) {
  console.log(
    `[Civitatis] Parsing booking detail: ${bookingId}`
  );

  await dismissDashboardNotice(page);

  const result = { client: { name: null, phone: null }, warnings: [] };

  const screenshotService =
    new ReservationScreenshotService();

  /*
   * =====================================================
   * RESERVATION DETAILS
   * =====================================================
   *
   * LI pertama otomatis terbuka.
   */

  result.reservation =
    await parseReservationDetails(
      page,
      bookingId,
      screenshotService
    );

  /*
   * =====================================================
   * CLIENT DETAILS
   * =====================================================
   */

  try {
    result.client = await parseClientDetails(page);
  } catch (error) {
    result.warnings.push({ stage: "client-details", message: error.message });
    console.warn(`[Civitatis] Booking ${bookingId}: client details unavailable (${error.name}: ${error.message}). Reservation preserved.`);
    return result;
  }

  /*
   * =====================================================
   * PHONE
   * =====================================================
   */

  try {
    result.client.phone = await showClientTelephone(page);
  } catch (error) {
    result.warnings.push({ stage: "client-phone", message: error.message });
    console.warn(`[Civitatis] Booking ${bookingId}: phone unavailable (${error.name}: ${error.message}). Reservation preserved.`);
  }

  console.log(
    "[Civitatis] Booking detail parsed."
  );

  return result;
}


/*
 * =====================================================
 * RESERVATION DETAILS
 * =====================================================
 */

async function parseReservationDetails(
  page,
  bookingId,
  screenshotService
) {
  /*
   * Cari section berdasarkan title,
   * bukan berdasarkan posisi LI.
   */

  const section =
    await findSection(
      page,
      "Reservation details"
    );

  if (!section) {
    throw new Error(
      "Reservation details section not found."
    );
  }

  /*
   * Ambil tanggal booking dibuat.
   */

  const bookingMadeOn =
    await section.$eval(
      "p.detail-table__sub .a-title__sub--highlight",
      el => el.textContent.trim()
    ).catch(() => null);

  /*
   * Ambil semua pasangan TH/TD.
   */

  const fields =
    await section.$$eval(
      "table.detail-table tbody tr",
      rows => {
        const result = {};

        for (const row of rows) {
          const th =
            row.querySelector("th");

          if (!th) {
            continue;
          }

          const key =
            th.textContent
              .trim()
              .replace(/\s+/g, " ");

          const cells =
            Array.from(
              row.querySelectorAll("td")
            ).map(td =>
              td.textContent
                .trim()
                .replace(/\s+/g, " ")
            );

          /*
           * People mempunyai dua TD:
           *
           * fino a 2 persone
           * 1,550,000IDR
           */

          if (
            row.classList.contains(
              "_dif-row"
            )
          ) {
            result[key] = cells;

            continue;
          }

          result[key] =
            cells.length === 1
              ? cells[0]
              : cells;
        }

        return result;
      }
    );

  /*
   * =====================================================
   * SCREENSHOT
   * =====================================================
   *
   * Data sudah selesai diparse.
   *
   * Screenshot service hanya mengubah tampilan
   * sebelum mengambil screenshot.
   */

  const screenshot =
    await screenshotService.save(
      section,
      bookingId
    );

  return {
    bookingMadeOn,
    ...fields,
    screenshot,
  };
}


/*
 * =====================================================
 * CLIENT DETAILS
 * =====================================================
 */

async function parseClientDetails(page) {
  /*
   * Cari section Client details.
   */

  const section =
    await findSection(
      page,
      "Client details"
    );

  if (!section) {
    throw new Error(
      "Client details section not found."
    );
  }

  const header = await section.$("a.myaccount-data__item__header");
  const bodyVisible = await section.evaluate(element => {
    const body = element.querySelector(".myaccount-data__item__body");
    return Boolean(body && getComputedStyle(body).display !== "none" &&
      getComputedStyle(body).visibility !== "hidden" && body.getClientRects().length);
  });

  if (!bodyVisible && header) {
    await header.click();
  }

  await section.waitForSelector(".myaccount-data__item__body", {
    visible: true,
    timeout: 15000,
  });

  // Agency bookings require explicitly revealing customer details first.
  const links = await section.$$("a");
  for (const link of links) {
    const isRevealLink = await link.evaluate(el =>
      el.textContent.trim().toLowerCase() === "view customer details" &&
      getComputedStyle(el).display !== "none" && el.getClientRects().length > 0
    );
    if (isRevealLink) {
      await link.click();
      break;
    }
  }

  await section.waitForSelector(".m-client-data-list", {
    visible: true,
    timeout: 15000,
  });

  /*
   * Ambil nama client.
   *
   * Telephone belum kita ambil di sini.
   * Akan dilakukan melalui showClientTelephone().
   */

  const name =
    await section.$eval(
      ".m-client-data-list > li:first-child",
      el => el.textContent.trim()
    ).catch(() => null);

  return {
    name,
  };
}


/*
 * =====================================================
 * SHOW CLIENT TELEPHONE
 * =====================================================
 */

async function showClientTelephone(page) {
  /*
   * Cari Client details.
   */

  const section =
    await findSection(
      page,
      "Client details"
    );

  if (!section) {
    throw new Error(
      "Client details section not found."
    );
  }

  /*
   * Cek apakah nomor sudah tersedia.
   *
   * Setelah request berhasil:
   *
   * <a href="tel:+393473006913">
   */

  const existingPhone =
    await getPhoneFromSection(
      section
    );

  if (existingPhone) {
    console.log(
      "[Civitatis] Client phone already available."
    );

    return existingPhone;
  }

  /*
   * Cari "See client telephone number".
   */

  const phoneLink =
    await findPhoneRequestLink(
      section
    );

  if (!phoneLink) {
    console.log(
      "[Civitatis] Client telephone request link not found."
    );

    return null;
  }

  console.log(
    "[Civitatis] Requesting client telephone..."
  );

  /*
   * Klik.
   */

  await phoneLink.click();

  /*
   * Tunggu popup.
   */

  await page.waitForSelector(
    ".popupbox.is-active",
    {
      visible: true,
      timeout: 15000,
    }
  );

  console.log(
    "[Civitatis] Telephone request popup opened."
  );

  /*
   * ===================================================
   * SELECT REASON = OTHER
   * ===================================================
   */

  const otherReason =
    await page.waitForSelector(
      '.popupbox.is-active #phoneRequestReasons label[for="reason_5"]',
      {
        visible: true,
        timeout: 15000,
      }
    );

  await otherReason.click();

  /*
   * ===================================================
   * OTHER REASON INPUT
   * ===================================================
   */

  const reasonInput =
    await page.waitForSelector(
      '.popupbox.is-active #reason_extra_5',
      {
        visible: true,
        timeout: 15000,
      }
    );

  await reasonInput.click();

  await reasonInput.type(
    "Booking confirmation"
  );

  /*
   * ===================================================
   * CONDITION
   * ===================================================
   */

  const condition =
    await page.waitForSelector(
      '.popupbox.is-active #condition',
      {
        visible: false,
        timeout: 15000,
      }
    );

  /*
   * Jangan click kalau sudah checked.
   */

  const checked =
    await condition.evaluate(
      input => input.checked
    );

  if (!checked) {
    const conditionLabel = await page.waitForSelector(
      '.popupbox.is-active #phoneRequestReasons label[for="condition"]',
      { visible: true, timeout: 15000 }
    );
    await conditionLabel.click();
  }

  /*
   * ===================================================
   * SEE NUMBER
   * ===================================================
   */

  const submit =
    await page.waitForSelector(
      '.popupbox.is-active button[type="submit"]',
      {
        visible: true,
        timeout: 15000,
      }
    );

  console.log(
    "[Civitatis] Clicking See number..."
  );

  await submit.click();

  /*
   * ===================================================
   * WAIT POPUP CLOSE
   * ===================================================
   */

  await page.waitForFunction(
    () =>
      !document.querySelector(
        ".popupbox.is-active"
      ),
    {
      timeout: 10000,
    }
  );

  console.log(
    "[Civitatis] Telephone popup closed."
  );

  /*
   * ===================================================
   * GET PHONE
   * ===================================================
   */

  await page.waitForFunction(
    () => Array.from(document.querySelectorAll('.m-client-data-list a[href^="tel:"]'))
      .some(el => el.getClientRects().length > 0 &&
        getComputedStyle(el).display !== "none" &&
        getComputedStyle(el).visibility !== "hidden"),
    {
      timeout: 15000,
    }
  ).catch(() => { });

  const phone =
    await getPhoneFromSection(
      section
    );

  console.log(
    `[Civitatis] Client phone: ${phone ? "available" : "not found"}`
  );

  return phone;
}


/*
 * =====================================================
 * FIND SECTION
 * =====================================================
 */

async function findSection(
  page,
  title
) {
  const sections =
    await page.$$(
      "ul.myaccount-data > li.myaccount-data__item"
    );

  for (const section of sections) {
    const sectionTitle =
      await section.$eval(
        "a.myaccount-data__item__header",
        el =>
          el.getAttribute("title")
            ?.trim() || ""
      ).catch(() => "");

    if (
      sectionTitle === title
    ) {
      return section;
    }
  }

  return null;
}


/*
 * =====================================================
 * FIND PHONE REQUEST LINK
 * =====================================================
 */

async function findPhoneRequestLink(
  section
) {
  const links =
    await section.$$(
      ".m-client-data-list a"
    );

  for (const link of links) {
    const text =
      await link.evaluate(
        el =>
          el.textContent
            .trim()
            .toLowerCase()
      );

    if (
      text.includes(
        "see client telephone number"
      )
    ) {
      return link;
    }
  }

  return null;
}


/*
 * =====================================================
 * GET PHONE
 * =====================================================
 */

async function getPhoneFromSection(
  section
) {
  const phone =
    await section.$eval(
      '.m-client-data-list a[href^="tel:"]',
      el => {
        if (!el.getClientRects().length ||
            getComputedStyle(el).display === "none" ||
            getComputedStyle(el).visibility === "hidden") {
          return null;
        }
        const href =
          el.getAttribute(
            "href"
          );

        return (
          href
            ?.replace(
              /^tel:/,
              ""
            )
            .trim() || null
        );
      }
    ).catch(() => null);

  return phone;
}

/** Dismiss only the known, non-binding dashboard announcement. */
export async function dismissDashboardNotice(page) {
  const buttons = await page.$$(".popupbox.is-active button");
  for (const button of buttons) {
    const isNotice = await button.evaluate(el => {
      const popup = el.closest(".popupbox.is-active");
      return el.textContent.trim() === "Understood" &&
        popup?.textContent.includes("Updates to the supplier dashboard!");
    });
    if (!isNotice) continue;
    await button.click();
    await page.waitForFunction(() =>
      !Array.from(document.querySelectorAll(".popupbox.is-active")).some(popup =>
        popup.textContent.includes("Updates to the supplier dashboard!") &&
        getComputedStyle(popup).display !== "none" &&
        getComputedStyle(popup).visibility !== "hidden" &&
        popup.getClientRects().length > 0
      ), { timeout: 15000 });
    return;
  }
}
