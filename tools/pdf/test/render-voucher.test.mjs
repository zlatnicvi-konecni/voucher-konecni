import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, rgb, degrees } from 'pdf-lib';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import jsQR from 'jsqr';
import { PNG } from 'pngjs';
import { renderTestVoucherPdf, renderCalibrationPdf, templateSha256 } from '../render-voucher.mjs';
const mm = n => n * 72 / 25.4;
// Arbitrary positions on synthetic test pages, NOT coordinates for the originals.
const layout = { page: 2, units: 'mm-bottom-left', visualApproved: true, printApproved: true,
  qr: { x: 6, y: 12, width: 22, height: 22 },
  code: { x: 6, y: 5, width: 48, height: 5, fontSizePt: 9 },
  expiry: { x: 64, y: 12, width: 40, height: 5, fontSizePt: 9 } };
const record = { environment: 'test', paymentConfirmed: true, status: 'ISSUED', voucherId: 'fixture-only',
  amount: 3000, currency: 'CZK', code: 'TEST-NOT-VALID-3K', validUntil: '2028-11-10' };
async function fixture({ pages = 2, width = 170, rotated = false } = {}) {
  const pdf = await PDFDocument.create();
  for (let n = 0; n < pages; n++) {
    const page = pdf.addPage([mm(width), mm(120)]);
    page.drawRectangle({ x: 0, y: mm(50), width: mm(width), height: mm(70), color: rgb(0.9, 0.94, 0.96) });
    page.drawText(`SYNTHETIC TEST PAGE ${n + 1} / NO VALUE`, { x: mm(8), y: mm(80), size: 14 });
    page.drawRectangle({ x: mm(120), y: mm(5), width: mm(40), height: mm(30), color: rgb(0.7, 0.5, 0.2) });
    if (rotated) page.setRotation(degrees(90));
  }
  return pdf.save();
}
const options = bytes => ({ record, templateBytes: bytes, approvedTemplate: { amount: 3000, sha256: templateSha256(bytes), layout: structuredClone(layout) } });

test('all three amounts: two pages, unchanged size/art outside fields, QR equals stored/text code, stored expiry and regeneration', async () => {
  await mkdir('work', { recursive: true });
  const dir = await mkdtemp(path.resolve('work', 'pdf-fixture-'));
  try {
    const bytes = await fixture();
    const originalHash = templateSha256(bytes);
    await writeFile(path.join(dir, 'fixture.pdf'), bytes);
    const raster = async (file, page) => {
      const prefix = path.join(dir, `render-${path.basename(file)}-${page}`);
      execFileSync('pdftoppm', ['-f', String(page), '-l', String(page), '-singlefile', '-scale-to-x', '1700', '-scale-to-y', '1200', '-png', file, prefix], { cwd: dir });
      return PNG.sync.read(await readFile(prefix + '.png'));
    };
    const originalPages = [await raster(path.join(dir, 'fixture.pdf'), 1), await raster(path.join(dir, 'fixture.pdf'), 2)];
    for (const amount of [3000, 5000, 10000]) {
      const code = `TEST-NOT-VALID-${amount}`;
      const config = options(bytes); config.record = { ...record, amount, code }; config.approvedTemplate.amount = amount;
      for (let attempt = 0; attempt < 2; attempt++) {
        const result = await renderTestVoucherPdf(config);
        const pdf = await PDFDocument.load(result);
        assert.equal(pdf.getPageCount(), 2);
        pdf.getPages().forEach(page => {
          assert.ok(Math.abs(page.getWidth() - mm(170)) < 0.01);
          assert.ok(Math.abs(page.getHeight() - mm(120)) < 0.01);
        });
        const file = path.join(dir, `result-${amount}-${attempt}.pdf`);
        await writeFile(file, result);
        const front = await raster(file, 1), back = await raster(file, 2);
        assert.deepEqual(front.data, originalPages[0].data, 'front unchanged pixel for pixel');
        const mask = Object.values(layout).filter(value => value && typeof value === 'object');
        for (let y = 0; y < back.height; y++) for (let x = 0; x < back.width; x++) {
          const inOverlay = mask.some(b => x >= b.x * 10 - 2 && x <= (b.x + b.width) * 10 + 2 && y >= (120 - b.y - b.height) * 10 - 2 && y <= (120 - b.y) * 10 + 2);
          if (!inOverlay) {
            const i = (y * back.width + x) * 4;
            if (!back.data.subarray(i, i + 4).equals(originalPages[1].data.subarray(i, i + 4))) assert.fail('art changed outside approved overlay');
          }
        }
        const decoded = jsQR(new Uint8ClampedArray(back.data), back.width, back.height);
        assert.equal(decoded?.data, code, 'QR must encode exact stored code');
        const text = execFileSync('pdftotext', [file, '-'], { encoding: 'utf8', cwd: dir });
        assert.ok(text.includes(code));
        assert.ok(text.includes('10.11.2028'));
        assert.ok(text.includes('SYNTHETIC TEST PAGE 2'));
      }
    }
    assert.equal(templateSha256(bytes), originalHash, 'input PDF bytes never mutated');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('fails closed without verified paid/issued TEST record, original hash, matching amount and approved layout', async () => {
  const bytes = await fixture();
  for (const patch of [{ environment: 'production' }, { paymentConfirmed: false }, { status: 'PENDING_PAYMENT' }, { status: 'PAYMENT_CONFIRMED' }, { status: 'CANCELLED' }, { voucherId: '' }, { amount: 1500 }, { currency: 'EUR' }, { code: ' CODE ' }, { code: '' }, { validUntil: '2028-02-30' }]) {
    await assert.rejects(renderTestVoucherPdf({ ...options(bytes), record: { ...record, ...patch } }));
  }
  const absent = options(bytes); absent.templateBytes = undefined;
  await assert.rejects(renderTestVoucherPdf(absent), /TEMPLATE_REQUIRED/);
  const tampered = options(bytes); tampered.approvedTemplate.sha256 = '0'.repeat(64);
  await assert.rejects(renderTestVoucherPdf(tampered), /TEMPLATE_MISMATCH/);
  const wrongAmount = options(bytes); wrongAmount.approvedTemplate.amount = 10000;
  await assert.rejects(renderTestVoucherPdf(wrongAmount), /TEMPLATE_MISMATCH/);
  for (const patch of [{ visualApproved: false }, { printApproved: false }, { page: 1 }, { units: 'pixels' }]) {
    const config = options(bytes); Object.assign(config.approvedTemplate.layout, patch);
    await assert.rejects(renderTestVoucherPdf(config), /LAYOUT_NOT_APPROVED/);
  }
});

test('rejects wrong page geometry and layouts that overlap, miss fields, shrink QR or truncate code', async () => {
  for (const spec of [{ pages: 1 }, { pages: 3 }, { width: 171 }, { rotated: true }]) {
    const bytes = await fixture(spec);
    await assert.rejects(renderTestVoucherPdf(options(bytes)), /TEMPLATE_(MUST_HAVE_TWO_PAGES|SIZE_OR_ROTATION_INVALID)/);
  }
  const bytes = await fixture();
  for (const patch of [{ qr: { ...layout.qr, width: 10, height: 10 } }, { expiry: { ...layout.expiry, x: 10, y: 15 } }, { qr: { ...layout.qr, x: 140 } }, { code: { ...layout.code, width: 4 } }]) {
    const config = options(bytes); Object.assign(config.approvedTemplate.layout, patch);
    await assert.rejects(renderTestVoucherPdf(config));
  }
});


test('calibration is explicitly invalid and cannot take a registry code or approve a real layout', async () => {
  const bytes = await fixture();
  const proposedTemplate = options(bytes).approvedTemplate;
  proposedTemplate.layout.visualApproved = false;
  proposedTemplate.layout.printApproved = false;
  const result = await renderCalibrationPdf({ templateBytes: bytes, proposedTemplate,
    record: { ...record, code: 'IGNORED-REGISTRY-CODE' } });
  const pdf = await PDFDocument.load(result);
  assert.equal(pdf.getPageCount(), 2);
  assert.equal(pdf.getTitle(), 'NEPLATNY TEST / kalibrace predlohy');
  await assert.rejects(renderTestVoucherPdf({ record, templateBytes: bytes, approvedTemplate: proposedTemplate }), /LAYOUT_NOT_APPROVED/);
});

test('text fit uses rendered glyph advances, so kerning cannot hide an overflow', async () => {
  const bytes = await fixture();
  const config = options(bytes);
  config.record = { ...record, amount: 10000, code: 'TEST-NEPLATNY-10000' };
  config.approvedTemplate.amount = 10000;
  config.approvedTemplate.layout.code.width = 35;
  // Kerning estimate is 34.55 mm, actual plain-Tj advances are 35.82 mm at 9 pt.
  await assert.rejects(renderTestVoucherPdf(config), /TEXT_WOULD_OVERFLOW/);
  config.approvedTemplate.layout.code.fontSizePt = 8.5;
  const result = await renderTestVoucherPdf(config);
  assert.equal((await PDFDocument.load(result)).getPageCount(), 2);
});
