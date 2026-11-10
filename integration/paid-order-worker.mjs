// Not registered as events.js or a public webMethod. Dependencies are TEST adapters.
import { createHash } from 'node:crypto';
import { inspectPaidOrder } from '../wix/backend/voucher-domain.mjs';
import { seal, open } from './protocol.mjs';
export function createPaidOrderWorker({ environment, siteId, catalog, readVerifiedOrder, transport, key, now }) {
  if (environment !== 'test' || !siteId || typeof readVerifiedOrder !== 'function' || typeof transport !== 'function') throw new Error('TEST_ADAPTERS_REQUIRED');
  return async event => {
    if (typeof event?.orderId !== 'string' || !event.orderId || event.orderId.length > 100) throw new Error('ORDER_ID_REQUIRED');
    // Trigger payload is not payment evidence. Read with server identity every time.
    const order = await readVerifiedOrder(event.orderId);
    if (order?.environment !== 'test' || order.siteId !== siteId || order.id !== event.orderId) throw new Error('ORDER_SCOPE_REJECTED');
    if (order.paymentStatus !== 'PAID') return { status: 'IGNORED', records: [] };
    if (order.cancelled !== false || order.refunded !== false || order.discounted !== false) return { status: 'MANUAL_REVIEW', records: [] };
    const plan = inspectPaidOrder(order, catalog);
    if (!plan.eligible) return { status: 'MANUAL_REVIEW', records: [] };
    // Freeze the complete purchase, so later quantity/price edits cannot emit new units.
    const items = [...order.items].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    const orderFingerprint = createHash('sha256').update(JSON.stringify([siteId, order.id, order.currency, order.totalMinor,
      items.map(i => [i.id, i.productId, i.variantId, i.quantity, i.unitAmountMinor])])).digest('hex');
    const records = [];
    for (const item of items) for (let unitNumber = 1; unitNumber <= item.quantity; unitNumber++) {
      const request = { kind: 'ISSUE_UNIT_TEST', environment, siteId, orderId: order.id, lineItemId: item.id,
        productId: item.productId, variantId: item.variantId, quantity: item.quantity, unitNumber,
        amountMinor: item.unitAmountMinor, currency: order.currency, paymentStatus: 'PAID', orderFingerprint };
      const response = open(await transport(seal(request, { key, now })), { key, now });
      const expectedKey = JSON.stringify([siteId, order.id, item.id, unitNumber]);
      if (response.kind !== 'ISSUE_UNIT_TEST_RESULT' || response.siteId !== siteId || response.unitKey !== expectedKey || response.orderFingerprint !== orderFingerprint || response.record?.amount !== item.unitAmountMinor / 100 || response.record?.currency !== order.currency || response.record?.environment !== 'test' || response.record?.paymentConfirmed !== true || response.record?.status !== 'PDF_READY' || typeof response.record?.code !== 'string' || !response.record.code) throw new Error('ISSUE_RESPONSE_REJECTED');
      records.push(response.record);
    }
    return { status: 'COMPLETE', records };
  };
}
