import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat.js";

dayjs.extend(customParseFormat);

export class NormalizeReservationService {
  normalizeCivitatis(booking) {
    const reservation = booking.detail?.reservation ?? {};

    const client = booking.detail?.client ?? {};

    const supplierBookingId = booking.booking?.id;

    if (!supplierBookingId) {
      throw new Error("Civitatis booking ID is required.");
    }

    return {
      supplier_booking_id: supplierBookingId,

      supplier_reference: null,

      booking_url: booking.booking?.href ?? null,

      tour_name: booking.service ?? "",

      tour_option: reservation["Selected option"] ?? null,

      tour_date: this.parseDate(reservation["Date"] ?? booking.date),

      tour_time: this.parseTime(reservation["Time"]),

      customer_name: client.name ?? booking.booking?.traveler ?? "",

      customer_email: null,

      customer_phone: client.phone ?? null,

      pax_total: booking.booking?.people
        ? Number(booking.booking.people)
        : this.parsePax(reservation["People"]),

      language: this.parseLanguage(reservation["Language"]),

      pickup_time: this.parseTime(reservation["Time"]),

      pickup_address: this.cleanPickup(reservation["Pickup point"]),

      pickup_lat: null,

      pickup_lng: null,

      sale_price: this.parseMoney(reservation["Sale price"]),

      net_price: this.parseMoney(reservation["Net price"]),

      currency: "IDR",

      customer_note: null,

      internal_note: null,

      status: "NEW",
    };
  }

  parseDate(value) {
    if (!value) {
      return null;
    }

    const date = dayjs(value, "MMMM D, YYYY", true);

    if (!date.isValid()) {
      return null;
    }

    return date.format("YYYY-MM-DD");
  }

  parseTime(value) {
    if (!value) {
      return null;
    }

    const text = String(value)
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();

    /*
     * Cari pola:
     *
     * 08:00 am
     * 8:00 am
     * 08:30 pm
     * 9:00 pm
     *
     * Tidak harus seluruh string hanya berisi waktu.
     */
    const match = text.match(/(\d{1,2}):(\d{2})\s*(am|pm)/i);

    if (!match) {
      console.log(`[Normalize] Time not recognized: ${JSON.stringify(value)}`);

      return null;
    }

    let hour = Number(match[1]);
    const minute = Number(match[2]);
    const period = match[3].toLowerCase();

    if (hour < 1 || hour > 12 || minute < 0 || minute > 59) {
      return null;
    }

    if (period === "am") {
      if (hour === 12) {
        hour = 0;
      }
    } else {
      if (hour !== 12) {
        hour += 12;
      }
    }

    return [
      String(hour).padStart(2, "0"),
      String(minute).padStart(2, "0"),
      "00",
    ].join(":");
  }

  parsePax(value) {
    if (!Array.isArray(value)) {
      return 0;
    }

    const text = value[0] ?? "";

    const match = text.match(/\d+/);

    return match ? Number(match[0]) : 0;
  }

  parseLanguage(value) {
    if (!value) {
      return null;
    }

    const text = value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

    const languages = {
      IT: ["italian", "italiano", "italien"],

      FR: ["french", "francais", "francese", "frances"],

      ES: ["spanish", "espanol", "espagnol", "spagnolo", "espanhol"],
    };

    for (const [code, keywords] of Object.entries(languages)) {
      if (keywords.some((keyword) => text.includes(keyword))) {
        return code;
      }
    }

    return null;
  }

  parseMoney(value) {
    if (!value) {
      return null;
    }

    if (Array.isArray(value)) {
      value = value.find((item) => /\d/.test(item));
    }

    if (typeof value !== "string") {
      return null;
    }

    const number = value.replace(/[^\d-]/g, "");

    const parsed = Number(number);

    return Number.isFinite(parsed) ? parsed : null;
  }

  cleanPickup(value) {
    if (!value) {
      return null;
    }

    return value.replace(/\s*Modify pickup point\s*$/i, "").trim();
  }
}
