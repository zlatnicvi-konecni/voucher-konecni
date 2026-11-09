// Run from repository root with Playwright and Chromium installed.
const { chromium } = require('playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    const blocked = [];
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin === 'https://voucher.test' && ['/', '/online-vouchers.js'].includes(url.pathname)) {
        return route.fulfill({ contentType: url.pathname === '/' ? 'text/html' : 'text/javascript',
          body: fs.readFileSync(url.pathname === '/' ? 'index.html' : 'online-vouchers.js', 'utf8') });
      }
      blocked.push(url.hostname);
      return route.abort();
    });
    await page.goto('https://voucher.test/');
    assert.equal(await page.locator('#onlineVouchers').isVisible(), false);
    // UI-only fixture; does not represent server authorization.
    await page.evaluate(() => showAuthorizedDevice({ deviceName: 'TEST' }));
    assert.equal(await page.locator('#onlineVouchers').isVisible(), true);
    for (const [id, value] of Object.entries({ onlineOrder: 'TEST-1', onlineLine: 'TEST-LINE', onlineUnit: '1', onlineAmount: '1500', onlineEmail: 'example@example.invalid', onlineIssuer: 'Test', onlinePin: 'dummy' })) {
      await page.locator('#' + id).fill(value);
    }
    await page.locator('#onlinePaid').check();
    await page.locator('#onlineVoucherForm button[type=submit]').click();
    assert.match(await page.locator('#onlineMessage').textContent(), /poukaz nebyl vydán/);
    assert.equal(await page.locator('#onlinePin').inputValue(), '');
    await page.evaluate(() => showDeviceGateForRegistration());
    assert.equal(await page.locator('#onlineEmail').inputValue(), '');
    assert.equal(await page.locator('#onlineVouchers').isVisible(), false);
    assert.equal(blocked.some(host => host.includes('google')), false);
    assert.deepEqual(errors, []);
    console.log('Browser PASS: UI authorization fixture, submit, PIN/revocation clearing; no backend requests.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
