import { db } from "../database/mysql.js";

export class ReservationService {
    constructor(database = db) {
        this.db = database;
    }

    /**
     * Get active channel ID.
     *
     * Example:
     * CIVITATIS -> 3
     */
    async getChannelId(channelCode) {
        console.log(
            `[ReservationService] Looking up channel: ${channelCode}`
        );

        const [rows] = await this.db.execute(
            `
        SELECT id
        FROM channels
        WHERE code = ?
          AND status = 'ACTIVE'
        LIMIT 1
      `,
            [channelCode]
        );

        if (!rows.length) {
            throw new Error(
                `Channel "${channelCode}" not found or inactive.`
            );
        }

        console.log(
            `[ReservationService] Channel ${channelCode} -> id=${rows[0].id}`
        );

        return rows[0].id;
    }

    /**
     * Generate internal reservation number.
     *
     * Example:
     * RSV-20260812-A1B2C3D4
     */
    generateReservationNumber() {
        const date = new Date()
            .toISOString()
            .slice(0, 10)
            .replace(/-/g, "");

        const random = Math.random()
            .toString(36)
            .substring(2, 10)
            .toUpperCase();

        return `RSV-${date}-${random}`;
    }

    /**
     * Create or update reservation.
     *
     * Existing reservation:
     * - update booking details
     * - DO NOT update status
     *
     * New reservation:
     * - create with status from normalized data
     */
    async upsert(reservation, channelCode) {
        if (!reservation?.supplier_booking_id) {
            throw new Error(
                "supplier_booking_id is required."
            );
        }

        const channelId =
            await this.getChannelId(channelCode);

        console.log(
            `[ReservationService] Upserting supplier_booking_id=${reservation.supplier_booking_id} channel=${channelCode}`
        );

        const connection =
            await this.db.getConnection();

        try {
            await connection.beginTransaction();

            /*
             * Find existing reservation.
             *
             * Supplier booking identity:
             *
             * channel_id + supplier_booking_id
             */
            const [existingRows] =
                await connection.execute(
                    `
            SELECT
              id,
              status
            FROM reservations
            WHERE channel_id = ?
              AND supplier_booking_id = ?
            LIMIT 1
          `,
                    [
                        channelId,
                        reservation.supplier_booking_id,
                    ]
                );

            /*
             * ==========================================
             * EXISTING RESERVATION
             * ==========================================
             */
            if (existingRows.length) {
                const existing =
                    existingRows[0];

                await connection.execute(
                    `
            UPDATE reservations
            SET
              supplier_reference = ?,

              tour_name = ?,
              tour_option = ?,

              tour_date = ?,
              tour_time = ?,

              customer_name = ?,
              customer_email = ?,
              customer_phone = ?,

              pax_total = ?,
              language = ?,

              pickup_time = ?,
              pickup_address = ?,
              pickup_lat = ?,
              pickup_lng = ?,

              sale_price = ?,
              net_price = ?,
              currency = ?,

              customer_note = ?,
              internal_note = ?,

              updated_at = CURRENT_TIMESTAMP

            WHERE id = ?
          `,
                    [
                        reservation.supplier_reference ?? null,

                        reservation.tour_name ?? null,
                        reservation.tour_option ?? null,

                        reservation.tour_date ?? null,
                        reservation.tour_time ?? null,

                        reservation.customer_name ?? null,
                        reservation.customer_email ?? null,
                        reservation.customer_phone ?? null,

                        reservation.pax_total ?? 0,
                        reservation.language ?? null,

                        reservation.pickup_time ?? null,
                        reservation.pickup_address ?? null,
                        reservation.pickup_lat ?? null,
                        reservation.pickup_lng ?? null,

                        reservation.sale_price ?? null,
                        reservation.net_price ?? null,
                        reservation.currency ?? "IDR",

                        reservation.customer_note ?? null,
                        reservation.internal_note ?? null,

                        existing.id,
                    ]
                );

                await connection.commit();

                console.log(
                    `[ReservationService] Updated id=${existing.id} supplier_booking_id=${reservation.supplier_booking_id}`
                );

                return {
                    success: true,

                    action: "UPDATED",

                    id: existing.id,

                    supplier_booking_id:
                        reservation.supplier_booking_id,

                    channel: channelCode,

                    status: existing.status,
                };
            }

            /*
             * ==========================================
             * NEW RESERVATION
             * ==========================================
             */

            const [result] =
                await connection.execute(
                    `
            INSERT INTO reservations (
              channel_id,

              supplier_booking_id,
              supplier_reference,

              tour_name,
              tour_option,

              tour_date,
              tour_time,

              customer_name,
              customer_email,
              customer_phone,

              pax_total,
              language,

              pickup_time,
              pickup_address,
              pickup_lat,
              pickup_lng,

              sale_price,
              net_price,
              currency,

              customer_note,
              internal_note,

              status
            )
            VALUES (
              ?,
              ?,
              ?,
              ?,
              ?,
              ?,
              ?,
              ?,
              ?,
              ?,
              ?,
              ?,
              ?,
              ?,
              ?,
              ?,
              ?,
              ?,
              ?,
              ?,
              ?,
              ?
            )
          `,
                    [
                        channelId,

                        reservation.supplier_booking_id,
                        reservation.supplier_reference ?? null,

                        reservation.tour_name ?? null,
                        reservation.tour_option ?? null,

                        reservation.tour_date ?? null,
                        reservation.tour_time ?? null,

                        reservation.customer_name ?? null,
                        reservation.customer_email ?? null,
                        reservation.customer_phone ?? null,

                        reservation.pax_total ?? 0,
                        reservation.language ?? null,

                        reservation.pickup_time ?? null,
                        reservation.pickup_address ?? null,
                        reservation.pickup_lat ?? null,
                        reservation.pickup_lng ?? null,

                        reservation.sale_price ?? null,
                        reservation.net_price ?? null,
                        reservation.currency ?? "IDR",

                        reservation.customer_note ?? null,
                        reservation.internal_note ?? null,

                        reservation.status ?? "NEW",
                    ]
                );

            await connection.commit();

            console.log(
                `[ReservationService] Created id=${result.insertId} supplier_booking_id=${reservation.supplier_booking_id}`
            );

            return {
                success: true,

                action: "CREATED",

                id: result.insertId,

                supplier_booking_id:
                    reservation.supplier_booking_id,

                channel: channelCode,

                status:
                    reservation.status ?? "NEW",
            };
        } catch (error) {
            await connection.rollback();

            throw error;
        } finally {
            connection.release();
        }
    }

    /**
     * Create or update multiple reservations.
     *
     * One failed reservation does not stop
     * the remaining reservations.
     */
    async upsertMany(
        reservations,
        channelCode
    ) {
        if (!Array.isArray(reservations)) {
            throw new Error(
                "reservations must be an array."
            );
        }

        console.log(
            `[ReservationService] upsertMany started. count=${reservations.length} channel=${channelCode}`
        );

        const results = [];

        for (const reservation of reservations) {
            try {
                const result =
                    await this.upsert(
                        reservation,
                        channelCode
                    );

                results.push(result);
            } catch (error) {
                console.error(
                    `[ReservationService] Failed to upsert supplier_booking_id=${reservation?.supplier_booking_id}:`,
                    error.message
                );

                results.push({
                    success: false,

                    action: "FAILED",

                    supplier_booking_id:
                        reservation?.supplier_booking_id ??
                        null,

                    channel: channelCode,

                    error: error.message,
                });
            }
        }

        return results;
    }

    async close() {
        await this.db.end();
    }
}
