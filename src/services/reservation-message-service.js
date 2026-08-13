import fs from "node:fs/promises";
import path from "node:path";

export class ReservationMessageService {
  constructor({
    directory = "src/templates",
  } = {}) {
    this.directory = path.resolve(directory);
  }

  async createMany(reservations) {
    if (!Array.isArray(reservations)) {
      throw new Error(
        "Reservations must be an array."
      );
    }

    return Promise.all(
      reservations.map(
        reservation =>
          this.create(reservation)
      )
    );
  }

  async create(reservation) {
    if (!reservation) {
      throw new Error(
        "Reservation data is required."
      );
    }

    const language = String(
      reservation.language ?? ""
    )
      .trim()
      .toUpperCase();

    const filename =
      language === "FR"
        ? "fr.txt"
        : language === "IT"
          ? "it.txt"
          : null;

    if (!filename) {
      throw new Error(
        `Unsupported message language: ${reservation.language}`
      );
    }

    const templatePath = path.join(
      this.directory,
      filename
    );

    const template =
      await fs.readFile(
        templatePath,
        "utf8"
      );

    const date =
      this.formatDate(
        reservation.tour_date,
        language
      );

    const time =
      this.formatTime(
        reservation.tour_time ??
        reservation.pickup_time
      );

    const dateTime =
      this.formatDateTime(
        date,
        time,
        language
      );

    const values = {
      name:
        reservation.customer_name ?? "",

      tour:
        reservation.tour_name ?? "",

      date,

      time,

      date_time:
        dateTime,

      people:
        reservation.pax_total ?? 0,

      pickup:
        reservation.pickup_address ?? "",

      phone:
        reservation.customer_phone ?? "",
    };

    const message =
      template.replace(
        /{{\s*([^}]+?)\s*}}/g,
        (_, key) => {
          const value =
            values[key.trim()];

          return value == null
            ? ""
            : String(value);
        }
      );

    /*
     * Caption untuk screenshot.
     */
    const caption =
      this.createCaption(
        reservation
      );

    return {
      supplier_booking_id:
        reservation.supplier_booking_id,

      language,

      tour_name:
        reservation.tour_name ?? "",

      customer_name:
        reservation.customer_name ?? "",

      customer_phone:
        reservation.customer_phone ?? "",

      message,

      caption,
    };
  }

  formatCaptionDate(date) {
    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(date));
  }

  createCaption(reservation) {
    const language =
      String(reservation.language ?? "")
        .trim()
        .toUpperCase();

    const flag =
      language === "IT"
        ? "🇮🇹"
        : language === "FR"
          ? "🇫🇷"
          : "🌐";

    const tour =
      reservation.tour_name ?? "-";

    const option =
      reservation.tour_option ?? "";

    const tourDisplay = option
      ? `${tour} (${option})`
      : tour;

    return [
      `*${tourDisplay}*`,
      `*#${reservation.supplier_booking_id ?? "-"}*`,

      "",

      `🧍‍♀️ Name: ${reservation.customer_name ?? "-"
      }`,

      `📞 Phone: ${reservation.customer_phone ?? "-"
      }`,

      `📅 Date: ${this.formatCaptionDate(
        reservation.tour_date
      ) || "-"
      }`,

      `🕐 Time: ${this.formatTime(
        reservation.tour_time ??
        reservation.pickup_time
      ) || "-"
      }`,

      `📍 Pickup: ${reservation.pickup_address ?? "-"
      }`,

      `👨‍👩‍👧‍👦 Person : ${reservation.pax_total ?? 0
      }`,

      `🗣️ Language: ${flag} ${language}`,
    ].join("\n");
  }

  formatDate(
    value,
    language
  ) {
    if (!value) {
      return "";
    }

    const [
      year,
      month,
      day,
    ] = String(value)
      .split("-")
      .map(Number);

    if (
      !year ||
      !month ||
      !day
    ) {
      return String(value);
    }

    return new Intl.DateTimeFormat(
      language === "FR"
        ? "fr-FR"
        : "it-IT",
      {
        day: "numeric",
        month: "long",
        year: "numeric",
      }
    ).format(
      new Date(
        year,
        month - 1,
        day
      )
    );
  }

  formatTime(value) {
    if (!value) {
      return "";
    }

    const match =
      String(value).match(
        /^(\d{1,2}):(\d{2})/
      );

    if (!match) {
      return "";
    }

    const hour =
      Number(match[1]);

    const minute =
      match[2];

    if (
      hour < 0 ||
      hour > 23
    ) {
      return "";
    }

    const period =
      hour >= 12
        ? "pm"
        : "am";

    const displayHour =
      hour % 12 || 12;

    return `${String(
      displayHour
    ).padStart(2, "0")}:${minute} ${period}`;
  }

  formatDateTime(
    date,
    time,
    language
  ) {
    if (!date) {
      return "";
    }

    if (!time) {
      return date;
    }

    if (language === "IT") {
      return `${date} alle ${time}`;
    }

    return `${date} à ${time}`;
  }
}