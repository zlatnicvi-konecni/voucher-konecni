// Offline TEST adapter. Never call from a public Wix webMethod.
// Accepts an already-issued server record; cannot issue, activate or send a voucher.
import { createHash } from 'node:crypto';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import QRCode from 'qrcode';

const mm = value => value * 72 / 25.4;
const fail = code => { throw new Error(code); };
export const templateSha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const WIDTH = 170, HEIGHT = 120;

function validateBox(box) {
  if (!box || !['x', 'y', 'width', 'height'].every(key => Number.isFinite(box[key]))) fail('LAYOUT_INVALID');
  if (box.x < 0 || box.y < 0 || box.width <= 0 || box.height <= 0 || box.x + box.width > WIDTH || box.y + box.height > HEIGHT) fail('LAYOUT_OUTSIDE_PAGE');
}
function overlap(a, b) {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}
function validateLayout(layout, calibration) {
  // There are deliberately NO fallback coordinates or automatic approvals.
  if ((!calibration && (layout?.visualApproved !== true || layout?.printApproved !== true)) || layout?.page !== 2 || layout?.units !== 'mm-bottom-left') fail('LAYOUT_NOT_APPROVED');
  const boxes = [layout.qr, layout.code, layout.expiry];
  boxes.forEach(validateBox);
  if (boxes.some((a, i) => boxes.slice(i + 1).some(b => overlap(a, b)))) fail('LAYOUT_OVERLAP');
  if (layout.qr.width !== layout.qr.height || layout.qr.width < 18) fail('QR_TOO_SMALL');
  // Only the lower-left code field and lower-centre expiry field may be used.
  if ([layout.qr, layout.code].some(b => b.x + b.width > WIDTH / 3 || b.y + b.height > HEIGHT / 3) || layout.expiry.x < WIDTH / 3 || layout.expiry.x + layout.expiry.width > WIDTH * 2 / 3 || layout.expiry.y + layout.expiry.height > HEIGHT / 3) fail('LAYOUT_WRONG_FIELD');
  for (const box of [layout.code, layout.expiry]) {
    if (!Number.isFinite(box.fontSizePt) || box.fontSizePt < 8 || box.fontSizePt > 14 || mm(box.height) < box.fontSizePt * 1.3) fail('TEXT_LAYOUT_INVALID');
  }
}
function recordText(record) {
  if (record?.environment !== 'test' || record?.paymentConfirmed !== true || !['ISSUED', 'PDF_READY', 'SENT'].includes(record?.status) || typeof record?.voucherId !== 'string' || !record.voucherId) fail('ISSUED_TEST_RECORD_REQUIRED');
  if (![3000, 5000, 10000].includes(record.amount) || record.currency !== 'CZK') fail('AMOUNT_INVALID');
  // Do not uppercase, trim, regenerate, truncate or otherwise change the stored code.
  if (typeof record.code !== 'string' || !/^[!-~]{1,128}$/.test(record.code)) fail('STORED_CODE_INVALID');
  if (typeof record.validUntil !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(record.validUntil)) fail('STORED_EXPIRY_INVALID');
  const date = new Date(record.validUntil + 'T00:00:00.000Z');
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== record.validUntil) fail('STORED_EXPIRY_INVALID');
  const [year, month, day] = record.validUntil.split('-');
  return { code: record.code, expiry: `${day}.${month}.${year}` };
}

async function render({ record, templateBytes, approvedTemplate }, calibration = false) {
  const text = recordText(record);
  if (!(templateBytes instanceof Uint8Array) || !templateBytes.length || templateBytes.length > 30 * 1024 * 1024) fail('TEMPLATE_REQUIRED');
  // The SHA and layout must be registered together by staff after inspecting the original.
  if (approvedTemplate?.amount !== record.amount || !/^[a-f0-9]{64}$/.test(approvedTemplate?.sha256 ?? '') || templateSha256(templateBytes) !== approvedTemplate.sha256) fail('TEMPLATE_MISMATCH');
  const layout = approvedTemplate.layout;
  validateLayout(layout, calibration);
  const pdf = await PDFDocument.load(new Uint8Array(templateBytes), { updateMetadata: false });
  if (pdf.getPageCount() !== 2) fail('TEMPLATE_MUST_HAVE_TWO_PAGES');
  for (const page of pdf.getPages()) {
    const media = page.getMediaBox(), crop = page.getCropBox();
    if (page.getRotation().angle !== 0 || [media, crop].some(box => Math.abs(box.x) > 0.01 || Math.abs(box.y) > 0.01 || Math.abs(box.width - mm(WIDTH)) > 0.2 || Math.abs(box.height - mm(HEIGHT)) > 0.2)) fail('TEMPLATE_SIZE_OR_ROTATION_INVALID');
  }
  const page = pdf.getPage(1), font = await pdf.embedFont(StandardFonts.Helvetica);
  for (const [box, value] of [[layout.code, text.code], [layout.expiry, text.expiry]]) {
    if (font.widthOfTextAtSize(value, box.fontSizePt) > mm(box.width)) fail('TEXT_WOULD_OVERFLOW');
  }
  const qr = QRCode.create([{ data: text.code, mode: 'byte' }], { errorCorrectionLevel: 'M' });
  const moduleSize = layout.qr.width / (qr.modules.size + 8); // 4-module quiet zone each side
  if (moduleSize < 0.3) fail('QR_MODULE_TOO_SMALL');
  const box = layout.qr;
  page.drawRectangle({ x: mm(box.x), y: mm(box.y), width: mm(box.width), height: mm(box.height), color: rgb(1, 1, 1) });
  for (let row = 0; row < qr.modules.size; row++) {
    for (let col = 0; col < qr.modules.size; col++) {
      if (qr.modules.get(row, col)) page.drawRectangle({
        x: mm(box.x + (col + 4) * moduleSize),
        y: mm(box.y + box.height - (row + 5) * moduleSize),
        width: mm(moduleSize), height: mm(moduleSize), color: rgb(0, 0, 0)
      });
    }
  }
  for (const [box, value] of [[layout.code, text.code], [layout.expiry, text.expiry]]) {
    page.drawText(value, { x: mm(box.x), y: mm(box.y) + box.fontSizePt * 0.25, size: box.fontSizePt, font, color: rgb(0, 0, 0) });
  }
  // No saveAsBase64, public links, filesystem, registry writes, email or network.
  // First page and original page graphics remain vector content; no raster remake.
  if (calibration) {
    pdf.setTitle('NEPLATNY TEST / kalibrace predlohy');
    pdf.setSubject('Pouze zkusebni rozlozeni; kod neni v registru; datum je priklad.');
  }
  return pdf.save();
}

// Normal rendering still requires a staff-approved original/layout and issued TEST record.
export const renderTestVoucherPdf = input => render(input);
// Calibration cannot accept a registry code or issue a voucher. It only uses a fixed
// conspicuously invalid code/date, so staff can inspect/print before approving layout.
export const renderCalibrationPdf = ({ templateBytes, proposedTemplate }) => render({
  templateBytes, approvedTemplate: proposedTemplate,
  record: { environment: 'test', paymentConfirmed: true, status: 'ISSUED',
    voucherId: 'calibration-only-not-in-registry', currency: 'CZK',
    amount: proposedTemplate?.amount, code: `TEST-NEPLATNY-${proposedTemplate?.amount}`, validUntil: '2028-11-10' }
}, true);
