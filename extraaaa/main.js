const puppeteer = require('puppeteer-extra');
const stealth = require('puppeteer-extra-plugin-stealth');
const getUrls = require('./getUrls');
const scrape = require('./scraper');

const { getMessage } = require('./getMessage');
puppeteer.use(stealth());

const { fsPromises, path, resultJsonPath } = require('./libs');
const { sendForTomorrow } = require('./tomorrow');


(async () => {
    const browser = await puppeteer.launch({ 
        headless: false, 
        executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 
        args: ['--no-sandbox', '--disable-setuid-sandbox'] 
    });
    const page = await browser.newPage();
    await page.goto('https://www.civitatis.com/en/providers/', { waitUntil: 'networkidle2' });
    await page.click('#login-collaborators-trigger');
    await page.waitForSelector('#login-name');
    await page.type('#login-name', 'balitravelawesome690@gmail.com');
    await page.type('#login-password', 'Trisula');
    await page.click('.a-new-form-button');
    await page.waitForNavigation({ waitUntil: 'networkidle2' });
    await page.mouse.click(10, 10);

    await page.waitForSelector('#s2id_timePeriodType .select2-choice', { visible: true });
    await page.click('#s2id_timePeriodType .select2-choice');
    await page.waitForSelector('.select2-results li', { visible: true });
    await page.evaluate(() => {
        const items = Array.from(document.querySelectorAll('.select2-results li'));
        const target = items.find(item =>
            item.textContent?.trim() === 'Other date'
        );
        if (target) {
            target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
        } else {
            console.log('Other date');
        }
    });

    const content = await fsPromises.readFile(resultJsonPath, 'utf8');
    const existing = JSON.parse(content);
    const skipIdArray = new Set(existing.map(item => item.reservationId));
    const urls = await getUrls(page, skipIdArray);

    const results = await scrape(urls, browser);

    const filePath = path.resolve('results.json');

    // Baca data sebelumnya jika file ada
    let existingData = [];

    try {
        const fileContent = await fsPromises.readFile(filePath, 'utf8');
        existingData = JSON.parse(fileContent);
        if (!Array.isArray(existingData)) {
            existingData = []; // fallback jika bukan array
        }
    } catch (err) {
        // File belum ada? Tidak masalah, mulai dari array kosong
        if (err.code !== 'ENOENT') throw err;
    }

    // Tambahkan data baru
    existingData.push(...results); // results harus berupa array

    // Simpan kembali ke file
    await fsPromises.writeFile(resultJsonPath, JSON.stringify(existingData, null, 2), 'utf8');
    console.log('✅ Data ditambahkan ke results.json');
    await browser.close();

    await getMessage()
    await sendForTomorrow()
})();