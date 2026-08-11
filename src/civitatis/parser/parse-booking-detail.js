import { ReservationScreenshotService } from "./reservation-screenshot-service.js";

export async function parseBookingDetail(
  page,
  bookingId
) {
  console.log(
    `[Civitatis] Parsing booking detail: ${bookingId}`
  );

  const result = {};

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

  result.client =
    await parseClientDetails(page);

  /*
   * =====================================================
   * PHONE
   * =====================================================
   */

  result.client.phone =
    await showClientTelephone(page);

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

  /*
   * Klik header Client details
   * kalau belum terbuka.
   */

  const header =
    await section.$(
      "a.myaccount-data__item__header"
    );

  if (header) {
    const visible =
      await section.evaluate(
        element => {
          const body =
            element.querySelector(
              ".myaccount-data__item__body"
            );

          if (!body) {
            return false;
          }

          const style =
            window.getComputedStyle(
              body
            );

          return (
            style.display !== "none"
          );
        }
      );

    if (!visible) {
      console.log(
        "[Civitatis] Opening Client details..."
      );

      await header.click();

      await page.waitForFunction(
        element => {
          const body =
            element.querySelector(
              ".myaccount-data__item__body"
            );

          if (!body) {
            return false;
          }

          return (
            window.getComputedStyle(
              body
            ).display !== "none"
          );
        },
        {
          timeout: 5000,
        },
        section
      );
    }
  }

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
      timeout: 5000,
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
      'input[name="reason_id"][value="5"]',
      {
        visible: true,
        timeout: 5000,
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
      "#reason_extra_5",
      {
        visible: true,
        timeout: 5000,
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
      "#condition",
      {
        visible: true,
        timeout: 5000,
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
    await condition.click();
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
        timeout: 5000,
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
    () =>
      Boolean(
        document.querySelector(
          'a[href^="tel:"]'
        )
      ),
    {
      timeout: 5000,
    }
  ).catch(() => {});

  const phone =
    await getPhoneFromSection(
      section
    );

  console.log(
    `[Civitatis] Client phone: ${
      phone || "not found"
    }`
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