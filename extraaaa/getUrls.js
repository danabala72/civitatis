async function getUrls(page, skipIds) {
    await page.waitForFunction(() => {
        const accordion = document.querySelectorAll('li.accordion-item.is-active');
        return Array.from(accordion).some(item =>
            item.textContent && !item.textContent.includes('No data')
        );
    });
    const accordionItems = await page.$$('li.accordion-item.is-active');
    const urls = [];
    for (let i = 0; i < accordionItems.length; i++) {
        const rows = await accordionItems[i].$$('tbody tr:not(._subtable-tr-container)');

        for (const row of rows) {
            try {
                await row.click();

                // Tunggu subtable muncul
                await page.waitForSelector('tr._subtable-tr-container', { timeout: 60000 });

                // Tunggu wrapper datatables benar-benar muncul
                const subtable = await page.waitForSelector('.dataTables_wrapper', { timeout: 60000 });

                if (!subtable) {
                    console.warn('Subtable tidak ditemukan.');
                    continue;
                }

                // Beri jeda agar render selesai
                await page.waitForTimeout?.(1000) || new Promise(r => setTimeout(r, 1000));
              

                
                const detailRows = await page.$$('td._subtable-tr-container table tbody tr');
                for (let j = 0; j < detailRows.length; j++) {
                    try {
                        // Ambil ulang elemen supaya fresh
                        const currentRow = (await page.$$('td._subtable-tr-container table tbody tr'))[j];
                        
                        const isAttached = await currentRow.evaluate(el => el.isConnected);
                        if (!isAttached) {
                            console.warn('Element detached, skip...');
                            continue;
                        }
                        
                                               
                        // Hover dan tunggu response API
                        const [response] = await Promise.all([
                            page.waitForResponse(res =>
                                res.url().includes('/api/providers/activityJob') &&
                                res.status() === 200, { timeout: 10000 }),
                            currentRow.hover(),                           
                        ]);

                        const data = await response.json();
                        if (data?.values) {
                            const data = await response.json();

                            for (const item of data.values) {
                                const id = item.idHash;
                                const type = item.type;

                                const reservationId = item.id;

                                if (skipIds.has(reservationId.toString())) {
                                    console.log('Skip ID:', reservationId);
                                    continue;
                                } else if (id && type) {
                                    const url = `https://www.civitatis.com/en/providers/v2/bookings/activity/book?bookingId=${id}&type=${type}`;
                                    console.log('URL:', url);
                                    urls.push(url);
                                }
                            }
                        }
                    } catch (innerErr) {
                        console.warn(`Row ${j} error: ${innerErr.message}`);
                    }
                }

            } catch (rowErr) {
                console.warn(`Row processing failed: ${rowErr.message}`);
            }
        }
    }

    return urls
}

module.exports = getUrls