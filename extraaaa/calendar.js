const { ics } = require("./libs");

async function generateEvents(tours) {
    const unconfirmed = tours.filter((tour) => !tour.confirmed);
    if (unconfirmed.length === 0) return null

    const data = [];
    for (const tour of unconfirmed) {
        const startDate = new Date(tour.date); // hanya tanggal
        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 1);

        const [startY, startM, startD] = [
            startDate.getFullYear(),
            startDate.getMonth() + 1,
            startDate.getDate(),
        ];

        const [endY, endM, endD] = [
            endDate.getFullYear(),
            endDate.getMonth() + 1,
            endDate.getDate(),
        ];

        data.push({
            uid: `${tour.reservationId}@balitravelawesome.com`,
            start: [startY, startM, startD],
            end: [endY, endM, endD],
            title: `${tour.reservationId} | ${tour.tour.trim()} ${tour.option ? '| ' + tour.option.trim() : ''} (${tour.language.trim()})`,
            description: `Name: ${tour.name}\nPhone: ${tour.phone}\nTour: ${tour.tour}\nOption: ${tour.option || ''}\nLanguage: ${tour.language}\nPickup: ${tour.pickup}\nPeople: ${tour.people}`,
            location: tour.pickup,
        });
    }
    

    return new Promise((resolve, reject) => {
        ics.createEvents(data, (error, value) => {
            if (error) return reject(error);
            resolve(value); // ✅ hasil string BEGIN:VEVENT ... END:VEVENT
        });
    });
}

module.exports = {
    generateEvents
};
