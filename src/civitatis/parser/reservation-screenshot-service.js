import fs from "node:fs/promises";
import path from "node:path";

export class ReservationScreenshotService {
  constructor({
    directory = "screenshots/reservation",
  } = {}) {
    this.directory = path.resolve(
      directory
    );
  }

  async save(
    section,
    bookingId
  ) {
    if (!bookingId) {
      throw new Error(
        "bookingId is required for reservation screenshot."
      );
    }

    await fs.mkdir(
      this.directory,
      {
        recursive: true,
      }
    );

    /*
     * Sembunyikan harga hanya pada DOM
     * yang akan di-screenshot.
     *
     * Tidak mengubah data yang sudah
     * diparsing menjadi JSON.
     */
    
    await section.evaluate(element => {
    /*
    * Sembunyikan harga
    */
    const rows = Array.from(
        element.querySelectorAll(
        "table.detail-table tbody tr"
        )
    );

    const peopleRow = rows.find(row =>
        row
        .querySelector("th")
        ?.textContent
        ?.trim() === "People"
    );

    if (peopleRow) {
        const cells =
        peopleRow.querySelectorAll("td");

        if (cells.length > 1) {
        cells[1].style.display = "none";
        }
    }

    const salePriceRow = rows.find(row =>
        row
        .querySelector("th")
        ?.textContent
        ?.trim() === "Sale price"
    );

    if (salePriceRow) {
        salePriceRow.style.display = "none";
    }

    const netPriceRow = rows.find(row =>
        row
        .querySelector("th")
        ?.textContent
        ?.trim() === "Net price"
    );

    if (netPriceRow) {
        netPriceRow.style.display = "none";
    }

    /*
    * Batasi lebar Reservation Details
    * supaya area kosong kanan tidak ikut.
    */
    element.style.width = "750px";
    element.style.maxWidth = "750px";
    });

    const screenshotPath =
      path.join(
        this.directory,
        `${bookingId}.png`
      );

    await section.screenshot({
      path: screenshotPath,
    });

    console.log(
      `[Civitatis] Reservation screenshot saved: ${screenshotPath}`
    );

    return screenshotPath;
  }
}