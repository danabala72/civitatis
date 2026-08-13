async function scrape(urls, browser) {
    const results = [];

    for (const url of urls) {
        const newPage = await browser.newPage();
        await newPage.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });

        try {
            await newPage.waitForSelector('h1.a-title._with-subtitle', { timeout: 10000 });

            const title = await newPage.$eval('h1.a-title._with-subtitle', el => el.textContent.trim());
            const id = title.replace('Reservation details ', '');

            const tourElement = await newPage.$eval('.a-title__sub', el => el.textContent?.trim() || '');
            const tour = tourElement.split('(')[0].trim();
            const detail = await newPage.evaluate(() => {
                const table = document.querySelector('table.detail-table tbody');
                const rows = table ? Array.from(table.querySelectorAll('tr')) : [];
                const detail = {};

                for (const row of rows) {
                    const th = row.querySelector('th')?.innerText.trim();
                    const tds = row.querySelectorAll('td');

                    switch (th) {
                        case 'Selected option':
                            detail.option = tds[0]?.innerText.trim();
                            break;
                        case 'Date':
                            detail.date = tds[0]?.innerText.trim(); // e.g. "July 28, 2025"
                            break;
                        case 'Time':
                            detail.time = tds[0]?.innerText.trim(); // e.g. "09:00 am"
                            break;
                        case 'Language':
                            const lang = tds[0]?.innerText.trim();
                            if (lang.includes('français')) {
                                detail.language = 'FR';
                            } else if (lang.includes('italiano')) {
                                detail.language = 'IT';
                            }
                            break;
                        case 'City of origin':
                            detail.city = tds[0]?.innerText.trim();
                            break;
                        case 'Pickup point':
                            // Clone node and remove <a> inside
                            const cloned = tds[0]?.cloneNode(true);
                            if (cloned) {
                                cloned.querySelectorAll('a').forEach(a => a.remove());
                                detail.pickup = cloned.innerText.trim();
                            }
                            break;
                        case 'People':
                            const person = tds[0]?.innerText.trim();
                            const match = person.match(/\d+/);
                            const number = match ? parseInt(match[0], 10) : 0;
                            detail.people = number
                            break;                        
                    }
                }

                return detail;
            });

            // Tunggu kontainer muncul
            await newPage.waitForSelector('li.myaccount-data__item._big-pd-2', { timeout: 5000 });
            const items = await newPage.$$('li.myaccount-data__item._big-pd-2');
            let userDetails = {name: '', phone: ''};
            for (const item of items) {
                const link = await item.$('a[title="Client details"]');
                if (link) {
                    await link.click(); // klik elemen link

                    // Tunggu hingga elemen <div class="myaccount-data__item__body"> yang ada DI DALAM <li> ini muncul
                    await newPage.waitForFunction(
                        el => {
                            const body = el.querySelector('.myaccount-data__item__body');
                            return body && body.offsetParent !== null;
                        },
                        {},
                        item
                    );
                    const btn = await item.$('.u-nomargin--b > a');
                    if(btn){
                        await btn.click();
                        await item.waitForSelector('.m-client-data-list', { timeout: 5000 });
                        const list = await item.$('.m-client-data-list');
                        if (list) {
                            const liItems = await list.$$('li');
                                                   
                            const text = await liItems[0].evaluate(el => el.innerText);
                            const phoneElement = await liItems[1].$('a');
                            let phone = '';
                            if (phoneElement) {
                                phone = await phoneElement.evaluate(el => el.innerText);
                            }
                            userDetails = {name: text, phone: phone.replaceAll(' ', '')};
                           
                        } else {
                            console.log('Element .m-client-data-list not found');
                        }
                    } else {
                        await newPage.waitForSelector('.m-client-data-list', { timeout: 5000 });
                        const list = await newPage.$('.m-client-data-list');
                        if (list) {
                            const liItems = await list.$$('li');
                                                
                            const text = await liItems[0].evaluate(el => el.innerText);
                            const phoneElement = await liItems[1].$('a');
                            let phone = '';
                            if(phoneElement){
                                phone = await phoneElement.evaluate(el => el.innerText);
                            }
                            userDetails = { name: text, phone: phone.replaceAll(' ', '') };
                        
                        } else {
                            console.log('Element .m-client-data-list not found');
                        }
                    }

                    console.log('Client details expanded.');
                    
                    break; // keluar dari loop setelah berhasil klik dan expand
                }
            }


            await newPage.evaluate(() => {
                document.querySelectorAll('tr._dif-row._np-b._no-border').forEach(tr => {
                    const tds = tr.querySelectorAll('td');
                    if (tds.length >= 2) tds[1].style.display = 'none';
                });

                document.querySelectorAll('li.myaccount-data__item._big-pd-2').forEach((item, index) => {
                    if (index > 0) item.style.display = 'none';
                });

                document.querySelectorAll('tr._total._np-t._np-b').forEach(item => {
                    item.style.display = 'none';
                });
            });

            
            // Tunggu konten client detail muncul
            await newPage.waitForSelector('#booking-page-new-content', { timeout: 10000 });
            const element = await newPage.$('#booking-page-new-content');
            if (element) {
                await element.screenshot({ path: `bookings/booking-content-${id}.png` });
                console.log('📸 Screenshot berhasil tanpa elemen yang disembunyikan');
            } else {
                console.log('⚠️ Elemen dengan ID #booking-page-new-content tidak ditemukan');
            }

            results.push({ url, reservationId: id, title, tour, ...detail, ...userDetails, confirmed: false, idMessage: null });

        } catch (e) {
            console.log(`❌ Gagal ambil data dari ${url}:`, e.message);
        }

        await newPage.close();
    }

    return results;
}

module.exports = scrape;