import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";

import axios from "axios";
import FormData from "form-data";

export class GreenApiWhatsAppService {
  constructor({
    instanceId =
    process.env.GREENAPI_INSTANCE_ID,

    token =
    process.env.GREENAPI_TOKEN,

    chatId =
    process.env.GREENAPI_CHAT_ID,

    sentFile =
    "data/whatsapp-sent.json",
  } = {}) {
    if (!instanceId) {
      throw new Error(
        "GREENAPI_INSTANCE_ID is required."
      );
    }

    if (!token) {
      throw new Error(
        "GREENAPI_TOKEN is required."
      );
    }

    if (!chatId) {
      throw new Error(
        "GREENAPI_CHAT_ID is required."
      );
    }

    this.instanceId = instanceId;
    this.token = token;
    this.chatId = chatId;

    this.sendMessageUrl =
      `https://7103.api.greenapi.com/waInstance${instanceId}/sendMessage/${token}`;

    this.sendImageUrl =
      `https://7103.media.greenapi.com/waInstance${instanceId}/sendFileByUpload/${token}`;

    this.sentFile =
      path.resolve(sentFile);
  }

  async ensureSentFile() {
    await fs.mkdir(
      path.dirname(this.sentFile),
      {
        recursive: true,
      }
    );

    if (!fsSync.existsSync(this.sentFile)) {
      await fs.writeFile(
        this.sentFile,
        "[]",
        "utf8"
      );
    }
  }

  async getSentIds() {
    await this.ensureSentFile();

    const content =
      await fs.readFile(
        this.sentFile,
        "utf8"
      );

    try {
      const data =
        JSON.parse(content);

      return Array.isArray(data)
        ? data
        : [];
    } catch {
      throw new Error(
        `Invalid JSON in ${this.sentFile}`
      );
    }
  }

  async hasBeenSent(
    supplierBookingId
  ) {
    const sentIds =
      await this.getSentIds();

    return sentIds.includes(
      String(supplierBookingId)
    );
  }

  async markAsSent(
    supplierBookingId
  ) {
    const sentIds =
      await this.getSentIds();

    const id =
      String(supplierBookingId);

    if (sentIds.includes(id)) {
      return;
    }

    sentIds.push(id);

    await fs.writeFile(
      this.sentFile,
      JSON.stringify(
        sentIds,
        null,
        2
      ),
      "utf8"
    );
  }

  /*
   * Kirim TEMPLATE TEXT
   */
  async sendMessage(message) {
    if (!message) {
      throw new Error(
        "Message is required."
      );
    }

    const response =
      await axios.post(
        this.sendMessageUrl,
        {
          chatId: this.chatId,
          message,
        }
      );

    return response.data;
  }

  /*
   * Kirim IMAGE + CAPTION
   */
  async sendImage(
    filePath,
    caption = ""
  ) {
    if (!filePath) {
      throw new Error(
        "Image path is required."
      );
    }

    if (!fsSync.existsSync(filePath)) {
      throw new Error(
        `Image not found: ${filePath}`
      );
    }

    const form =
      new FormData();

    form.append(
      "chatId",
      this.chatId
    );

    form.append(
      "caption",
      caption
    );

    form.append(
      "file",
      fsSync.createReadStream(
        filePath
      )
    );

    const response =
      await axios.post(
        this.sendImageUrl,
        form,
        {
          headers:
            form.getHeaders(),
        },
      );

    return response.data;
  }

  /*
   * Satu reservation:
   *
   * 1. Check ID
   * 2. Send template
   * 3. Send image + caption
   * 4. Mark ID as sent
   */
  async sendReservation({
    supplier_booking_id,
    message,
    imagePath,
    caption,
  }) {
    const bookingId =
      String(
        supplier_booking_id
      );

    /*
     * Jangan kirim kalau sudah pernah
     * berhasil dikirim.
     */
    if (
      await this.hasBeenSent(
        bookingId
      )
    ) {
      console.log(
        `[WhatsApp] Skip ${bookingId} - already sent.`
      );

      return {
        supplier_booking_id:
          bookingId,

        skipped: true,

        sent: false,
      };
    }

    console.log(
      `[WhatsApp] Sending ${bookingId}...`
    );

    /*
     * =========================
     * 1. TEMPLATE MESSAGE
     * =========================
     */
    const messageResult =
      await this.sendMessage(
        message
      );

    console.log(
      `[WhatsApp] Template sent: ${bookingId}`
    );

    /*
     * =========================
     * 2. IMAGE + CAPTION
     * =========================
     */
    const imageResult =
      await this.sendImage(
        imagePath,
        caption
      );

    console.log(
      `[WhatsApp] Image + caption sent: ${bookingId}`
    );

    /*
     * =========================
     * 3. MARK AS SENT
     *
     * Hanya dilakukan kalau
     * message DAN image sukses.
     * =========================
     */
    await this.markAsSent(
      bookingId
    );

    console.log(
      `[WhatsApp] Completed: ${bookingId}`
    );

    return {
      supplier_booking_id:
        bookingId,

      skipped: false,

      sent: true,

      message: messageResult,

      image: imageResult,
    };
  }

  /*
   * Kirim banyak reservation
   * secara berurutan.
   */
  async sendReservations(reservations) {
    if (!Array.isArray(reservations)) {
      throw new Error(
        "Reservations must be an array."
      );
    }

    const results = [];

    for (
      let i = 0;
      i < reservations.length;
      i++
    ) {
      const reservation =
        reservations[i];

      try {
        // Jeda hanya sebelum reservation berikutnya
        if (i > 0) {
          await this.sleepRandom();
        }

        const result =
          await this.sendReservation(
            reservation
          );

        results.push(result);
      } catch (error) {
        console.error(
          `[WhatsApp] Failed ${reservation.supplier_booking_id}:`,
          error.response?.data ||
          error.message
        );

        results.push({
          supplier_booking_id:
            String(
              reservation.supplier_booking_id
            ),

          skipped: false,

          sent: false,

          error:
            error.response?.data ||
            error.message,
        });
      }
    }

    return results;
  }

  async sleepRandom() {
    const delay =
      Math.floor(
        Math.random() * (5000 - 2000 + 1)
      ) + 2000;

    console.log(
      `[WhatsApp] Waiting ${delay}ms...`
    );

    await new Promise((resolve) =>
      setTimeout(resolve, delay)
    );
  }
}