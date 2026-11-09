// All URLs below are intercepted before navigation. No real backend/CDN access.
const { chromium } = require('playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--proxy-server=http://127.0.0.1:9', '--proxy-bypass-list=<-loopback>'] });
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(15000);
    const requests = [], replies = new Map(), unexpected = [];
    let automatic = false, nested = true, balance = 1500;
    const sandboxOrigin = 'https://test-fixture-script.googleusercontent.com';
    await page.route('**/*', async route => {
      const req = route.request(), url = new URL(req.url());
      if (url.origin === 'https://voucher.test') {
        if (url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: fs.readFileSync('index.html', 'utf8') });
        if (url.pathname === '/online-vouchers.js') return route.fulfill({ contentType: 'text/javascript', body: fs.readFileSync('online-vouchers.js', 'utf8') });
      }
      if (url.origin === 'https://script.google.com' && req.method() === 'POST') {
        const data = Object.fromEntries(new URLSearchParams(req.postData()));
        requests.push(data);
        let result = { ok: true };
        if (data.action === 'device-status') result.authorized = true;
        if (data.action === 'register-device') Object.assign(result, { deviceId: 'fixture-device', deviceToken: 'fixture-token' });
        if (data.action === 'redeem' && data.pin !== 'wrong') balance -= Number(data.amount);
        if (['create', 'lookup'].includes(data.action)) Object.assign(result, { code: 'TEST-CODE', amount: 1500, balance, expiry: '2030-01-01', status: balance ? 'ACTIVE' : 'REDEEMED' });
        if (['create', 'redeem'].includes(data.action) && data.pin === 'wrong') result = { ok: false, message: 'Fixture: invalid PIN' };
        replies.set(data.requestId, { type: 'voucher-api', requestId: data.requestId, result });
        // A client navigation keeps every hop intercepted (Playwright routing skips HTTP redirect hops).
        return route.fulfill({ contentType: 'text/html', body: '<script>location.replace(' + JSON.stringify('https://script.googleusercontent.com/reply?id=' + data.requestId) + ')</script>' });
      }
      if (url.origin === 'https://script.googleusercontent.com' && url.pathname === '/reply') {
        const id = url.searchParams.get('id');
        return route.fulfill({ contentType: 'text/html', body: nested
          ? `<iframe src="${sandboxOrigin}/sandbox?id=${id}"></iframe>`
          : `<script>${automatic ? 'top.postMessage(' + JSON.stringify(replies.get(id)) + ', "https://voucher.test")' : ''}</script>` });
      }
      if (url.origin === sandboxOrigin && url.pathname === '/sandbox') {
        return route.fulfill({ contentType: 'text/html', body: `<script>${automatic ? 'top.postMessage(' + JSON.stringify(replies.get(url.searchParams.get('id'))) + ', "https://voucher.test")' : ''}</script>` });
      }
      if (['https://evil.test', sandboxOrigin].includes(url.origin) && url.pathname === '/attacker') return route.fulfill({ contentType: 'text/html', body: '<p>unrelated frame</p>' });
      // Libraries are replaced by deterministic local doubles below.
      if (!url.hostname.endsWith('jsdelivr.net')) unexpected.push(url.origin);
      return route.abort();
    });
    await page.goto('https://voucher.test');
    await page.evaluate(() => localStorage.setItem('zlatnickaDilna_deviceAuth_v1', JSON.stringify({ deviceId: 'fixture-device', deviceToken: 'fixture-token' })));
    await page.evaluate(() => { window.authDone = false; window.authPromise = checkDeviceAuthorization().then(value => { window.authDone = true; return value; }); });
    await page.waitForFunction(() => document.getElementById('apiFrame').contentWindow.length === 1);
    const authRequest = requests.at(-1), good = replies.get(authRequest.requestId);
    if (!page.frames().some(f => f.url().startsWith(sandboxOrigin + '/sandbox'))) await page.waitForEvent('framenavigated', { predicate: f => f.url().startsWith(sandboxOrigin + '/sandbox') });
    const responseFrame = page.frames().find(f => f.url().startsWith(sandboxOrigin + '/sandbox'));
    assert.ok(responseFrame);
    // Correct request ID and trusted origin, but unrelated source window.
    for (const origin of [sandboxOrigin, 'https://evil.test']) {
      const handle = await page.evaluateHandle(src => { const f = document.createElement('iframe'); f.src = src + '/attacker'; document.body.appendChild(f); return f; }, origin);
      const attacker = await handle.asElement().contentFrame();
      await attacker.waitForLoadState();
      await attacker.evaluate(payload => top.postMessage(payload, 'https://voucher.test'), good);
    }
    // Correct source window but wrong/opaque/deceptive origins; wrong envelope.
    await page.evaluate(({ good, sandboxOrigin }) => {
      const source = document.getElementById('apiFrame').contentWindow[0];
      for (const origin of ['https://evil.test', 'null', 'http://script.google.com', 'https://script.googleusercontent.com.evil.test', 'https://googleusercontent.com', 'https://arbitrary.googleusercontent.com']) {
        dispatchEvent(new MessageEvent('message', { source, origin, data: good }));
      }
      for (const data of [{ ...good, requestId: 'wrong' }, { ...good, type: 'wrong' }, null]) dispatchEvent(new MessageEvent('message', { source, origin: sandboxOrigin, data }));
      dispatchEvent(new MessageEvent('message', { origin: sandboxOrigin, data: good }));
    }, { good, sandboxOrigin });
    await page.waitForTimeout(50);
    assert.equal(await page.evaluate(() => window.authDone), false);
    assert.equal(await page.evaluate(() => isAppsScriptResponse({ source: document.getElementById('apiFrame').contentWindow, origin: 'https://script.google.com' }, document.getElementById('apiFrame'))), true);
    assert.equal(await page.locator('#onlineVouchers').isVisible(), false);
    await responseFrame.evaluate(payload => top.postMessage(payload, 'https://voucher.test'), good);
    assert.equal(await page.evaluate(() => window.authPromise), true);
    assert.equal(await page.locator('#onlineVouchers').isVisible(), true);

    console.log('Authorization spoof/redirect tests passed');
    automatic = true;
    // Direct redirected response as well as the nested HtmlService response above.
    nested = false;
    await page.evaluate(() => checkDeviceAuthorization());
    nested = true;
    console.log('Direct redirect passed');
    await page.evaluate(() => { clearDeviceAuth(); showDeviceGateForRegistration(); });
    await page.locator('#registrationKey').fill('fixture-key');
    await page.evaluate(() => registerDevice());
    console.log('Registration passed');
    assert.equal(requests.at(-1).action, 'register-device');
    assert.equal(requests.at(-1).registrationKey, 'fixture-key');
    assert.equal(requests.at(-1).deviceToken, undefined);

    // Deterministic QR renderer: verify the value supplied to the unchanged library API.
    await page.evaluate(() => {
      window.qrValues = [];
      window.qrcode = () => ({ addData: value => qrValues.push(value), make() {}, createImgTag: () => '<img alt="fixture QR">' });
    });
    for (const [id, value] of Object.entries({ createAmount: '1500', createIssuer: 'Fixture', createPin: 'fixture-pin' })) await page.locator('#' + id).fill(value);
    await page.evaluate(() => createVoucher());
    assert.equal(await page.locator('#resultCode').textContent(), 'TEST-CODE');
    assert.deepEqual(await page.evaluate(() => qrValues), ['TEST-CODE']);
    assert.equal(await page.locator('#createPin').inputValue(), '');
    const create = requests.find(r => r.action === 'create');
    assert.equal(create.amount, '1500'); assert.equal(create.pin, 'fixture-pin');
    assert.equal(create.deviceToken, 'fixture-token');
    await page.locator('#redeemCode').fill('test-code');
    await page.evaluate(() => lookupVoucher());
    assert.match(await page.locator('#lookupBalance').textContent(), /1\s?500/);
    for (const amount of ['500', '1000']) {
      for (const [id, value] of Object.entries({ redeemAmount: amount, redeemOperator: 'Fixture', redeemPin: 'fixture-pin' })) await page.locator('#' + id).fill(value);
      await page.evaluate(() => redeemVoucher());
      assert.equal(await page.locator('#redeemPin').inputValue(), '');
    }
    assert.equal(await page.locator('#lookupBalance').textContent(), '0 Kč');
    assert.equal(await page.locator('#lookupStatus').textContent(), 'REDEEMED');
    assert.deepEqual(requests.filter(r => r.action === 'redeem').map(r => [r.code, r.amount, r.pin]), [['TEST-CODE', '500', 'fixture-pin'], ['TEST-CODE', '1000', 'fixture-pin']]);
    await page.locator('#createPin').fill('wrong');
    await page.evaluate(() => createVoucher());
    assert.match(await page.locator('#createMessage').textContent(), /invalid PIN/);
    for (const [id, value] of Object.entries({ redeemAmount: '1', redeemOperator: 'Fixture', redeemPin: 'wrong' })) await page.locator('#' + id).fill(value);
    await page.evaluate(() => redeemVoucher());
    assert.match(await page.locator('#redeemMessage').textContent(), /invalid PIN/);
    assert.equal(balance, 0);
    const count = requests.length;
    await page.locator('#createPin').fill('');
    await page.evaluate(() => createVoucher());
    await page.locator('#redeemPin').fill('');
    await page.evaluate(() => redeemVoucher());
    assert.equal(requests.length, count, 'missing PIN/amount cannot submit');
    // QR scanner routes the code to the existing lookup flow.
    await page.evaluate(async () => {
      window.BarcodeDetector = class { async detect() { return [{ rawValue: ' test-code ' }]; } };
      scannerRunning = true;
      await scanFrame();
    });
    await page.waitForFunction(() => document.getElementById('lookupStatus').textContent === 'REDEEMED');
    assert.equal(await page.locator('#redeemCode').inputValue(), 'TEST-CODE');
    // Printer call is intercepted, no Bluetooth or physical output.
    await page.evaluate(async () => {
      window.Niimbot = { isSupported: () => true, printImage: async (image, options) => { window.printFixture = { image, size: options.size, copies: options.copies }; } };
      createNiimbotLabelDataUrl = async code => 'fixture-label:' + code;
      await printNiimbotLabel();
    });
    const print = await page.evaluate(() => printFixture);
    assert.equal(print.image, 'fixture-label:TEST-CODE');
    assert.equal(print.size.w_px, 240); assert.equal(print.size.h_px, 160); assert.equal(print.size.dpi, 203);
    assert.equal(print.copies, 1);
    await page.evaluate(() => clearDeviceAuth());
    const unauthorizedCount = requests.length;
    await page.locator('#createPin').fill('fixture-pin');
    await page.evaluate(() => createVoucher());
    assert.equal(requests.length, unauthorizedCount, 'unregistered device cannot submit');
    assert.deepEqual(unexpected, []);
    console.log('PASS: forged messages rejected; redirected/nested replies accepted; registration, authorization, create, lookup, partial/full redeem, PIN, QR/scanner and NIIMBOT call regression (offline doubles).');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
