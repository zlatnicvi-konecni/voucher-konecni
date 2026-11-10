const { chromium } = require('playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox', '--proxy-server=http://127.0.0.1:9', '--proxy-bypass-list=<-loopback>'] });
  try {
    for (const width of [390, 768, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const unexpected = [];
      await page.route('**/*', route => {
        const url = new URL(route.request().url());
        const files = { '/': ['wix/preview/index.html', 'text/html'], '/preview.mjs': ['wix/preview/preview.mjs', 'text/javascript'], '/public/voucher-model.mjs': ['wix/public/voucher-model.mjs', 'text/javascript'] };
        const file = url.origin === 'https://preview.test' && files[url.pathname];
        if (file) return route.fulfill({ contentType: file[1], body: fs.readFileSync(file[0], 'utf8') });
        unexpected.push(url.origin); return route.abort();
      });
      await page.goto('https://preview.test');
      await page.getByRole('link', { name: 'Koupit dárkový poukaz' }).click();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      for (const amount of ['3000', '5000', '10000']) {
        await page.locator('#amount').selectOption(amount);
        for (const [id, value] of Object.entries({ recipientName: 'Test', recipientEmail: 'test@example.invalid', senderName: 'Test', message: '<script>invalid markup</script>' })) await page.locator('#' + id).fill(value);
        await page.locator('#privacy').check();
        await page.getByRole('button', { name: 'Pokračovat do pokladny' }).click();
        assert.match(await page.locator('#status').textContent(), /nebyly vytvořeny/);
        assert.equal(new URL(page.url()).origin, 'https://preview.test');
        await page.locator('#recipientName').fill('Changed');
        assert.equal(await page.locator('#status').textContent(), '');
      }
      await page.locator('#recipientEmail').fill('bad');
      await page.getByRole('button', { name: 'Pokračovat do pokladny' }).click();
      assert.equal(await page.locator('#status').textContent(), '');
      assert.deepEqual(unexpected, []);
      await page.close();
    }
    console.log('PASS: 390/768/1440px, no overflow, button → form, values, validation, no external navigation/API. Checkout remains disconnected.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
