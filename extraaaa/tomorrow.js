const { fsPromises, resultJsonPath, dayjs } = require('./libs');
const { sendMessage } = require('./sender');

async function sendForTomorrow(){
    try {
        const besok = dayjs().add(1, 'day');

        const data = await fsPromises.readFile(resultJsonPath, 'utf-8');
        const parsedData = JSON.parse(data);
        const resultBesok = parsedData.filter(item => {
            const tanggalTour = dayjs(item.date)
            return (
                tanggalTour.isValid() &&
                tanggalTour.startOf('day').isSame(besok, 'day') &&
                !!item.idMessage
            )
        })

        for (const item of resultBesok){
            const textDate = besok.format('YYYY-MM-DD');
            const reply = `Tour besok, ${textDate}`
            await sendMessage(reply, null,item.idMessage)
        }

    } catch (error) {
        console.error('Gagal membaca file JSON:', error);
    }
}

module.exports = {
    sendForTomorrow
}