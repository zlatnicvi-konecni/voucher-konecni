// Executable TEST contract for a future Apps Script bridge; NOT a deployed GAS API.
import { seal, open } from './protocol.mjs';
export function createTestReceiver({ environment, siteId, key, now, catalog, ledger, renderPdf, validUntil }) {
  if (environment !== 'test' || ledger?.environment !== 'test' || !siteId || typeof renderPdf !== 'function' || !/^\d{4}-\d{2}-\d{2}$/.test(validUntil ?? '')) throw new Error('TEST_ADAPTERS_REQUIRED');
  const expiry = new Date(validUntil + 'T00:00:00.000Z');
  if (!Number.isFinite(expiry.getTime()) || expiry.toISOString().slice(0, 10) !== validUntil) throw new Error('TEST_ADAPTERS_REQUIRED');
  return async envelope => {
    const p = open(envelope, { key, now });
    const ids = [p.orderId, p.lineItemId, p.productId, p.variantId];
    const product = catalog.find(c => c.productId === p.productId && c.variantId === p.variantId && c.kind === 'STORES_DIGITAL_VOUCHER');
    if (p.kind !== 'ISSUE_UNIT_TEST' || p.siteId !== siteId || p.paymentStatus !== 'PAID' || p.currency !== 'CZK' || ids.some(id => typeof id !== 'string' || !id || id.length > 100 || id.trim() !== id) || !product || product.currency !== 'CZK' || ![300000, 500000, 1000000].includes(p.amountMinor) || product.amountMinor !== p.amountMinor || !Number.isSafeInteger(p.quantity) || p.quantity < 1 || p.quantity > 10 || !Number.isSafeInteger(p.unitNumber) || p.unitNumber < 1 || p.unitNumber > p.quantity || !/^[a-f0-9]{64}$/.test(p.orderFingerprint ?? '')) throw new Error('ISSUE_REQUEST_REJECTED');
    // Real GAS must provide this SAME atomic contract inside its existing issuer/registry.
    // Never implement it as "check Sheets, then call legacy create" across requests.
    let record = ledger.issueOnce(p, validUntil);
    if (record.status !== 'PDF_READY') {
      const bytes = await renderPdf(record); // failure leaves the already-issued code intact
      record = ledger.savePdfOnce(record.voucherId, bytes);
    }
    return seal({ kind: 'ISSUE_UNIT_TEST_RESULT', environment, siteId,
      unitKey: JSON.stringify([siteId, p.orderId, p.lineItemId, p.unitNumber]),
      orderFingerprint: p.orderFingerprint, record }, { key, now });
  };
}
