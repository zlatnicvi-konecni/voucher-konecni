import { validateSelection, VALUES } from '../public/voucher-model.mjs';
// Proposed internal contract, NOT a Wix API payload. Server-owned product mapping.
export function checkoutIntent(input, productMap) {
  const selection = validateSelection(input);
  const product = productMap?.[selection.amount];
  if (!product?.productId || !product?.variantId || product.currency !== 'CZK' || product.kind !== 'STORES_DIGITAL_VOUCHER') throw new Error('CHECKOUT_NOT_CONFIGURED');
  return { kind: 'KONECNI_VOUCHER_V1', currency: 'CZK', quantity: selection.quantity,
    amountMinor: selection.amount * 100, productId: product.productId,
    totalMinor: selection.amount * 100 * selection.quantity,
    variantId: product.variantId,
    recipientSource: selection.recipientType === 'self' ? 'CHECKOUT_CUSTOMER' : 'GIFT_RECIPIENT',
    recipient: selection.recipientType === 'self' ? null : { name: selection.recipientName, email: selection.recipientEmail },
    senderName: selection.senderName, message: selection.message };
}
// Inspection only. No event handler is installed and no voucher is issued.
// Input must eventually come from an authenticated fresh server order read.
export function inspectPaidOrder(order, catalog) {
  if (order?.paymentStatus !== 'PAID') return { eligible: false, reason: 'NOT_PAID', units: [] };
  if (!order.id || order.currency !== 'CZK' || order.cancelled || order.refunded || order.discounted || !Array.isArray(order.items) || !order.items.length) return { eligible: false, reason: 'MANUAL_REVIEW', units: [] };
  const units = [], ids = new Set();
  // B0 contract supports voucher-only orders. Mixed carts require a later policy.
  for (const item of order.items) {
    const product = catalog?.find(p => p.productId === item.productId && p.variantId === item.variantId);
    if (!product || product.currency !== 'CZK' || !VALUES.includes(product.amountMinor / 100) || product.kind !== 'STORES_DIGITAL_VOUCHER' || !item.id || ids.has(item.id) || !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 10 || item.unitAmountMinor !== product.amountMinor) return { eligible: false, reason: 'MANUAL_REVIEW', units: [] };
    ids.add(item.id);
    for (let unit = 1; unit <= item.quantity; unit++) units.push({ key: JSON.stringify([order.id, item.id, unit]), amountMinor: product.amountMinor });
  }
  const sum = units.reduce((total, unit) => total + unit.amountMinor, 0);
  if (!Number.isSafeInteger(sum) || order.totalMinor !== sum) return { eligible: false, reason: 'TOTAL_MISMATCH', units: [] };
  return { eligible: true, units }; // Eligibility is NOT proof of issuance or idempotence.
}
