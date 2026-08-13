const { generateEvents } = require('./calendar');
const { fsPromises, path, resultJsonPath, calendarPath } = require('./libs');
const { sendMessage } = require('./sender');

async function getMessage() {
    const file = resultJsonPath;

    try {
        const data = await fsPromises.readFile(file, 'utf-8');
        const parsedData = JSON.parse(data);
        const events = await generateEvents(parsedData);

        for (const tour of parsedData) {
            if (!tour.confirmed) {
                try {
                    const message = await getTemplate(tour);
                    const { caption, imagePath } = await getCaption(tour);

                    const { idMessage } = await sendMessage(message);
                    await sendMessage(caption, imagePath);

                    // ✅ Tandai sebagai confirmed hanya jika keduanya berhasil
                    tour.confirmed = true;
                    tour.idMessage = idMessage

                } catch (error) {
                    console.error('Gagal mengirim pesan:', error);
                    // Jangan tandai sebagai confirmed jika ada kegagalan
                }
            }
        }

        // ✅ Simpan hasil yang sudah dimodifikasi

        await fsPromises.writeFile(resultJsonPath, JSON.stringify(parsedData, null, 2), 'utf-8');

        if (events) {
            await fsPromises.writeFile(calendarPath, events, 'utf-8');
            await sendMessage('Update Kalender', calendarPath);
        }

    } catch (error) {
        console.error('Gagal membaca atau menulis file:', error);
    }
}


async function getTemplate(target) {
    const lang = target.language
    try {
        const filePath = path.join(__dirname, 'templates', `${lang}.txt`);
        const fileContent = await fsPromises.readFile(filePath, 'utf-8');
        const newContent = await fillTemplate(fileContent, target);
        return newContent

    } catch (error) {
        console.error(`Gagal membaca template untuk bahasa ${lang}:`, error.message);
    }
}

async function fillTemplate(template, data) {
    return template.replace(/{{(.*?)}}/g, (_, key) => data[key.trim()] || '');
}

async function getCaption(target) {
    const { name, phone, date, time, pickup, reservationId, language, people } = target

    const caption = `🧍‍♀️ Name: ${name}
    📞 Phone: ${phone}
    📅 Date: ${date}
    🕐 Time: ${time}
    📍 Pickup: ${pickup}
    👨‍👩‍👧‍👦 Person : ${people}
    🗣️ Language: ${language}`;

    const imagePath = path.join(__dirname, 'bookings', `booking-content-${reservationId}.png`);

    return { caption, imagePath };
}

module.exports = {
    getMessage
}