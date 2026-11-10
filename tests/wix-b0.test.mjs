import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateSelection } from '../wix/public/voucher-model.mjs';
import { checkoutIntent, inspectPaidOrder } from '../wix/backend/voucher-domain.mjs';
const input = { amount: 3000, recipientName: 'Test', senderName: 'Test', recipientEmail: 'test@example.invalid', message: '', privacyAcknowledged: true };
const product = { productId: 'fixture', variantId: 'fixture-3k', currency: 'CZK', kind: 'STORES_DIGITAL_VOUCHER', amountMinor: 300000 };
const order = { id: 'fixture-order', paymentStatus: 'PAID', currency: 'CZK', totalMinor: 300000, items: [{ id: 'fixture-line', productId: 'fixture', variantId: 'fixture-3k', quantity: 1, unitAmountMinor: 300000 }] };
test('allowlisted values, recipient validation and server-owned checkout mapping', () => {
  for (const amount of [3000, 5000, 10000]) assert.equal(validateSelection({ ...input, amount }).amount, amount);
  for (const patch of [{ amount: -1 }, { amount: 1500 }, { recipientEmail: 'invalid' }, { privacyAcknowledged: false }, { recipientName: 'x'.repeat(101) }, { message: 'x'.repeat(501) }]) assert.throws(() => validateSelection({ ...input, ...patch }));
  assert.throws(() => checkoutIntent(input, {}), /NOT_CONFIGURED/);
  assert.equal(checkoutIntent({ ...input, productId: 'attacker', amountMinor: 1 }, { 3000: product }).amountMinor, 300000);
  assert.equal(checkoutIntent(input, { 3000: product }).productId, 'fixture');
});
test('payment inspection fails closed and creates stable per-unit identities, never issues', () => {
  for (const paymentStatus of ['NOT_PAID', 'PARTIALLY_PAID', 'REFUNDED', undefined]) assert.equal(inspectPaidOrder({ ...order, paymentStatus }, [product]).eligible, false);
  for (const patch of [{ currency: 'EUR' }, { refunded: true }, { cancelled: true }, { discounted: true }, { totalMinor: 1 }, { items: [{ ...order.items[0], quantity: 0 }] }, { items: [{ ...order.items[0], productId: 'unknown' }] }, { items: [order.items[0], order.items[0]] }]) assert.equal(inspectPaidOrder({ ...order, ...patch }, [product]).eligible, false);
  const first = inspectPaidOrder(order, [product]);
  assert.equal(first.eligible, true);
  assert.deepEqual(inspectPaidOrder(order, [product]), first);
  const two = inspectPaidOrder({ ...order, totalMinor: 600000, items: [{ ...order.items[0], quantity: 2 }] }, [product]);
  assert.equal(new Set(two.units.map(u => u.key)).size, 2);
});

test('native Wix page controller blocks double click and handles disconnected checkout safely', async () => {
  const { readFileSync } = await import('node:fs');
  const vm = await import('node:vm');
  const nodes = {};
  for (const id of ['voucherAmount', 'voucherQuantity', 'quantityMinus', 'quantityPlus', 'voucherPrice', 'recipientType', 'recipientFields', 'recipientName', 'recipientEmail', 'privacyAcknowledged', 'continueCheckout', 'voucherStatus']) nodes['#' + id] = {
    onChange(fn) { this.change = fn; }, onInput(fn) { this.input = fn; }, onClick(fn) { this.click = fn; },
    collapse() { this.collapsed = true; }, expand() { this.collapsed = false; },
    disable() { this.disabled = true; }, enable() { this.disabled = false; }, text: ''
  };
  Object.entries({ voucherAmount: '3000', voucherQuantity: '1', recipientType: 'other', recipientName: 'Test', recipientEmail: 'test@example.invalid' }).forEach(([id, value]) => { nodes['#' + id].value = value; });
  nodes['#privacyAcknowledged'].checked = true;
  const $w = id => nodes[id]; $w.onReady = fn => fn();
  let resolveCheckout, calls = 0;
  const prepareVoucherCheckout = () => { calls++; return new Promise(resolve => { resolveCheckout = resolve; }); };
  const source = readFileSync('wix/pages/darkovy-poukaz.js', 'utf8').replace(/^import .*;$/gm, '');
  vm.runInNewContext(source, { $w, validateSelection, prepareVoucherCheckout });
  assert.equal(nodes['#quantityMinus'].disabled, true);
  nodes['#quantityPlus'].click(); assert.equal(nodes['#voucherQuantity'].value, '2');
  nodes['#quantityMinus'].click(); assert.equal(nodes['#voucherQuantity'].value, '1');
  const button = nodes['#continueCheckout'];
  const pending = button.click();
  await button.click();
  assert.equal(calls, 1); assert.equal(button.disabled, true);
  assert.equal(nodes['#voucherQuantity'].disabled, true);
  resolveCheckout({ available: false, message: 'Pokladna nepřipojena.' }); await pending;
  assert.equal(button.disabled, false); assert.equal(nodes['#voucherStatus'].text, 'Pokladna nepřipojena.');
  nodes['#recipientName'].input(); assert.equal(nodes['#voucherStatus'].text, '');
  nodes['#recipientEmail'].value = 'invalid'; await button.click(); assert.equal(calls, 1);
  nodes['#recipientType'].value = 'self'; nodes['#recipientType'].change();
  assert.equal(nodes['#recipientEmail'].value, '');
  assert.equal(nodes['#recipientName'].value, '');
  assert.equal(nodes['#recipientEmail'].required, false);
  assert.equal(nodes['#recipientFields'].collapsed, true);
  nodes['#recipientType'].value = 'other'; nodes['#recipientType'].change();
  assert.equal(nodes['#recipientEmail'].required, true);
  assert.equal(nodes['#recipientFields'].collapsed, false);
});


test('quantity and recipient choice are validated server-side; self cannot smuggle hidden recipient', () => {
  for (const quantity of [0, -1, 11, 1.5, '2', NaN]) assert.throws(() => validateSelection({ ...input, quantity }));
  assert.throws(() => validateSelection({ ...input, recipientType: 'unknown' }));
  const other = checkoutIntent({ ...input, quantity: 3, recipientName: '' }, { 3000: product });
  assert.equal(other.quantity, 3); assert.equal(other.amountMinor, 300000); assert.equal(other.totalMinor, 900000);
  assert.equal(other.recipientSource, 'GIFT_RECIPIENT');
  const self = checkoutIntent({ ...input, recipientType: 'self', recipientEmail: 'stale@example.invalid', buyerEmail: 'forged@example.invalid' }, { 3000: product });
  assert.equal(self.recipient, null); assert.equal(self.recipientSource, 'CHECKOUT_CUSTOMER');
  assert.equal(validateSelection({ ...input, recipientType: 'self' }).recipientEmail, '');
});
