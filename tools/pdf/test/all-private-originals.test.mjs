// Whole OFFLINE contract chain, including actual private PDF originals.
// Simulated layout approval exists only in this fixture, never in shipped manifests.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import jsQR from 'jsqr';
import { PNG } from 'pngjs';
import { originalTemplates } from '../original-templates.mjs';
import { createPrivateTestPdfRenderer } from '../private-renderer.mjs';
import { createPaidOrderWorker } from '../../../integration/paid-order-worker.mjs';
import { createTestReceiver } from '../../../integration/test-apps-script-receiver.mjs';
import { SqliteTestLedger } from '../../../integration/testing/sqlite-ledger.mjs';

test('all private originals: PAID → durable TEST code → exact PDF/QR, retries and partial fixture redemption', {
  skip: !process.env.VOUCHER_ORIGINALS_DIR
}, async () => {
  const directory = path.resolve(process.env.VOUCHER_ORIGINALS_DIR);
  await mkdir('work', { recursive: true });
  const root = await mkdtemp(path.resolve('work', 'private-chain-'));
  const ledger = new SqliteTestLedger({ testRoot: root, databasePath: path.join(root, 'fixture.sqlite') });
  try {
    const catalog = [3000, 5000, 10000].map(amount => ({ productId: 'fixture-product', variantId: String(amount), amountMinor: amount * 100, currency: 'CZK', kind: 'STORES_DIGITAL_VOUCHER' }));
    let order = { environment: 'test', siteId: 'fixture-only', id: 'fixture-order', paymentStatus: 'NOT_PAID', cancelled: false, refunded: false, discounted: false,
      currency: 'CZK', totalMinor: 1800000, items: catalog.map((p, i) => ({ id: 'line-' + i, productId: p.productId, variantId: p.variantId, unitAmountMinor: p.amountMinor, quantity: 1 })) };
    const key = randomBytes(32);
    const unapproved = createPrivateTestPdfRenderer({ directory });
    await assert.rejects(unapproved({ environment: 'test', paymentConfirmed: true, status: 'ISSUED', voucherId: 'fixture', amount: 3000, currency: 'CZK', code: 'TEST-FIXTURE', validUntil: '2030-01-01' }), /LAYOUT_NOT_APPROVED/);
    const simulatedApprovals = structuredClone(originalTemplates);
    for (const template of Object.values(simulatedApprovals)) { template.layout.visualApproved = true; template.layout.printApproved = true; }
    const actualRenderer = createPrivateTestPdfRenderer({ directory, approvedTemplates: simulatedApprovals });
    let failFirstPdf = true;
    const receive = createTestReceiver({ environment: 'test', siteId: order.siteId, key, catalog, ledger, validUntil: '2030-01-01',
      renderPdf: async record => { if (failFirstPdf) { failFirstPdf = false; throw new Error('SIMULATED_PDF_FAILURE'); } return actualRenderer(record); } });
    const worker = createPaidOrderWorker({ environment: 'test', siteId: order.siteId, catalog, key, readVerifiedOrder: async () => structuredClone(order), transport: receive });
    assert.equal((await worker({ orderId: order.id, paymentStatus: 'PAID' })).status, 'IGNORED');
    assert.equal(ledger.rows().length, 0);
    order.paymentStatus = 'PAID';
    await assert.rejects(worker({ orderId: order.id }), /SIMULATED_PDF_FAILURE/);
    assert.equal(ledger.rows().length, 1); assert.equal(ledger.rows()[0].pdf, null);
    const firstCode = ledger.rows()[0].code;
    const result = await worker({ orderId: order.id });
    assert.equal(result.records[0].code, firstCode);
    assert.equal(result.records.length, 3);
    await Promise.all(Array.from({ length: 10 }, () => worker({ orderId: order.id })));
    const rows = ledger.rows(); assert.equal(rows.length, 3); assert.equal(new Set(rows.map(r => r.code)).size, 3);
    for (const row of rows) {
      const amount = row.amount_minor / 100, template = originalTemplates[amount];
      const output = path.join(root, `test-${amount}.pdf`), scan = path.join(root, `scan-${amount}.png`);
      const expected = path.join(root, `expected-${amount}.json`);
      await writeFile(output, row.pdf, { mode: 0o600 });
      await writeFile(expected, JSON.stringify({ code: row.code, layout: template.layout }), { mode: 0o600 });
      execFileSync('python', ['-c', `
import sys,json,fitz
from PIL import Image,ImageDraw,ImageChops
if not __debug__: raise RuntimeError('PDF verifier requires enabled assertions')
source,output,expected,image=sys.argv[1:];config=json.load(open(expected))
a=fitz.open(source);b=fitz.open(output);assert len(a)==len(b)==2
for i in range(2):
 assert abs(b[i].rect.width*25.4/72-170)<.01 and abs(b[i].rect.height*25.4/72-120)<.01
 pa=a[i].get_pixmap(dpi=300);pb=b[i].get_pixmap(dpi=300)
 ia=Image.frombytes('RGB',(pa.width,pa.height),pa.samples);ib=Image.frombytes('RGB',(pb.width,pb.height),pb.samples)
 diff=ImageChops.difference(ia,ib)
 if i==1:
  mask=Image.new('L',ia.size,0);draw=ImageDraw.Draw(mask);s=300/25.4
  for field in ['qr','code','expiry']:
   r=config['layout'][field];draw.rectangle((int(r['x']*s)-2,int((120-r['y']-r['height'])*s)-2,int((r['x']+r['width'])*s)+2,int((120-r['y'])*s)+2),fill=255)
  diff.paste((0,0,0),(0,0),mask);ib.save(image)
  assert config['code'] in b[i].get_text() and '01.01.2030' in b[i].get_text()
 assert diff.getbbox() is None
`, path.join(directory, template.filename), output, expected, scan], { cwd: root, stdio: 'pipe', env: { ...process.env, PYTHONOPTIMIZE: '0' } });
      const png = PNG.sync.read(await readFile(scan));
      assert.equal(jsQR(new Uint8ClampedArray(png.data), png.width, png.height)?.data, row.code);
      assert.equal(ledger.lookupFixture(row.code).status, 'PDF_READY');
    }
    const code = rows[0].code, balance = rows[0].balance_minor;
    assert.equal(ledger.redeemFixture(code, 50000).balanceMinor, balance - 50000);
    assert.equal((await worker({ orderId: order.id })).records[0].code, code);
    assert.equal(ledger.rows().length, 3);
    // Nothing in this test is a real Wix order, Apps Script deployment or Google Sheet.
  } finally { ledger.close(); await rm(root, { recursive: true, force: true }); }
});
