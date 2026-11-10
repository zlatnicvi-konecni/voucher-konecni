const { chromium } = require('playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox', '--proxy-server=http://127.0.0.1:9', '--proxy-bypass-list=<-loopback>'] });
  try {
    for (const width of [390, 768, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      page.setDefaultTimeout(15000);
      const unexpected = [];
      await page.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.href === 'https://static.wixstatic.com/media/3b66ad_f4ac0f05d5594d73a593a1977148ed69~mv2.png') return route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jVZkAAAAASUVORK5CYII=', 'base64') });
        if (url.hostname === 'static.parastorage.com' && url.pathname.includes('/fonts-cache/googlefont/woff2/s/caudex/')) return route.abort();
        const files = { '/': ['wix/preview/index.html', 'text/html'], '/preview.mjs': ['wix/preview/preview.mjs', 'text/javascript'], '/public/voucher-model.mjs': ['wix/public/voucher-model.mjs', 'text/javascript'] };
        const file = url.origin === 'https://preview.test' && files[url.pathname];
        if (file) return route.fulfill({ contentType: file[1], body: fs.readFileSync(file[0], 'utf8') });
        unexpected.push(url.origin); return route.abort();
      });
      await page.goto('https://preview.test');
      assert.equal(await page.locator('#voucherPhoto').getAttribute('src'), 'https://static.wixstatic.com/media/3b66ad_f4ac0f05d5594d73a593a1977148ed69~mv2.png');
      await page.getByRole('link', { name: 'Koupit dárkový poukaz' }).click();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      for (const amount of ['3000', '5000', '10000']) {
        await page.locator('input[name="amount"][value="' + amount + '"]').check();
        for (const [id, value] of Object.entries({ recipientName: 'Test', recipientEmail: 'test@example.invalid' })) await page.locator('#' + id).fill(value);
          await page.getByRole('button', { name: 'Koupit', exact: true }).click();
        assert.match(await page.locator('#status').textContent(), /nebyly vytvořeny/);
        assert.equal(new URL(page.url()).origin, 'https://preview.test');
        await page.locator('#recipientName').fill('Changed');
        assert.equal(await page.locator('#status').textContent(), '');
      }
      await page.locator('#recipientEmail').fill('bad');
      await page.getByRole('button', { name: 'Koupit', exact: true }).click();
      assert.equal(await page.locator('#status').textContent(), '');
      // Quantity and recipient controls shown in the owner's reference.
      await page.locator('#recipientEmail').fill('test@example.invalid');
      await page.getByRole('button', { name: 'Zvýšit množství' }).click();
      assert.equal(await page.locator('#quantity').inputValue(), '2');
      await page.getByRole('button', { name: 'Snížit množství' }).click();
      assert.equal(await page.locator('#minus').isDisabled(), true);
      await page.locator('#quantity').fill('10');
      assert.equal(await page.locator('#plus').isDisabled(), true);
      for (const invalid of ['0', '11', '1.5']) {
        await page.locator('#quantity').fill(invalid);
        await page.getByRole('button', { name: 'Koupit', exact: true }).click();
        assert.equal(await page.locator('#status').textContent(), '');
      }
      await page.locator('#quantity').fill('2');
      await page.getByRole('radio', { name: 'Pro mě', exact: true }).check();
      assert.equal(await page.locator('#recipientFields').isVisible(), false);
      assert.equal(await page.locator('#message').inputValue(), '');
      assert.equal(await page.locator('#recipientEmail').inputValue(), '');
      await page.getByRole('button', { name: 'Koupit', exact: true }).click();
      assert.match(await page.locator('#status').textContent(), /nebyly vytvořeny/);
      await page.getByRole('radio', { name: 'Pro někoho jiného', exact: true }).check();
      assert.equal(await page.locator('#recipientFields').isVisible(), true);
      await page.getByRole('button', { name: 'Koupit', exact: true }).click();
      assert.equal(await page.locator('#status').textContent(), '');
      await page.locator('#recipientEmail').fill('test@example.invalid');
      await page.locator('#recipientName').fill('');
      await page.getByRole('button', { name: 'Koupit', exact: true }).click();
      assert.match(await page.locator('#status').textContent(), /nebyly vytvořeny/);
      await page.locator('#deliveryDate').fill('2030-01-02');
      await page.locator('#deliveryTime').selectOption('14:15');
      await page.locator('#message').fill('Testovací zpráva');
      const more = page.locator('#more');
      assert.equal(await more.textContent(), 'Zjistit více');
      await more.click();
      assert.equal(await more.getAttribute('aria-expanded'), 'true');
      assert.equal(await page.locator('#descriptionMore').isVisible(), true);
      assert.match(await page.locator('#descriptionMore').textContent(), /pouze v kamenné prodejně/);
      assert.equal(await more.textContent(), 'Méně');
      assert.deepEqual(unexpected, []);
      await page.close();
    }
    console.log('PASS: 390/768/1440px, no overflow, button → form, values, validation, no external navigation/API. Checkout remains disconnected.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
