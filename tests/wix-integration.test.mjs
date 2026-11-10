import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { seal, open } from '../integration/protocol.mjs';
import { createPaidOrderWorker } from '../integration/paid-order-worker.mjs';
import { createTestReceiver } from '../integration/test-apps-script-receiver.mjs';
import { SqliteTestLedger } from '../integration/testing/sqlite-ledger.mjs';
const siteId = 'fixture-site-only', now = () => 1900000000000;
const catalog = [{ productId: 'fixture-product', variantId: '3k', kind: 'STORES_DIGITAL_VOUCHER', amountMinor: 300000, currency: 'CZK' }];
const baseOrder = { environment: 'test', siteId, id: 'fixture-order', paymentStatus: 'PAID', cancelled: false, refunded: false, discounted: false,
  currency: 'CZK', totalMinor: 300000, items: [{ id: 'line-1', productId: 'fixture-product', variantId: '3k', unitAmountMinor: 300000, quantity: 1 }] };
async function harness(t) {
  await mkdir('work', { recursive: true });
  const testRoot = await mkdtemp(path.resolve('work', 'integration-'));
  const config = { testRoot, databasePath: path.join(testRoot, 'fixture.sqlite') };
  let ledger = new SqliteTestLedger(config), order = structuredClone(baseOrder);
  const key = randomBytes(32);
  t.after(async () => { ledger.close(); await rm(testRoot, { recursive: true, force: true }); });
  const receiver = (renderPdf = async () => Buffer.from('%PDF-OFFLINE-DOUBLE')) => createTestReceiver({ environment: 'test', siteId, key, now, catalog, ledger, renderPdf, validUntil: '2030-01-01' });
  const worker = (transport = receiver()) => createPaidOrderWorker({ environment: 'test', siteId, catalog, key, now, readVerifiedOrder: async () => structuredClone(order), transport });
  return { config, key, worker, receiver, get ledger() { return ledger; }, setOrder(value) { order = value; },
    restart() { ledger.close(); ledger = new SqliteTestLedger(config); } };
}

test('NOT_PAID trigger with forged PAID is ignored; PAID creates one durable code/PDF even on concurrent replay', async t => {
  const h = await harness(t);
  h.setOrder({ ...baseOrder, paymentStatus: 'NOT_PAID' });
  assert.equal((await h.worker()({ orderId: baseOrder.id, paymentStatus: 'PAID' })).status, 'IGNORED');
  assert.equal(h.ledger.rows().length, 0);
  h.setOrder(baseOrder);
  const worker = h.worker();
  const results = await Promise.all(Array.from({ length: 20 }, () => worker({ orderId: baseOrder.id })));
  assert.equal(new Set(results.flatMap(r => r.records.map(v => v.code))).size, 1);
  assert.equal(h.ledger.rows().length, 1); assert.ok(h.ledger.rows()[0].pdf);
  const originalCode = results[0].records[0].code;
  h.restart();
  assert.equal((await h.worker()({ orderId: baseOrder.id })).records[0].code, originalCode);
  assert.equal(h.ledger.rows().length, 1);
});

test('PDF failure and timeout after commit recover the same code without extra issuance', async t => {
  const h = await harness(t);
  await assert.rejects(h.worker(h.receiver(async () => { throw new Error('SIMULATED_PDF_FAILURE'); }))({ orderId: baseOrder.id }), /SIMULATED_PDF_FAILURE/);
  assert.equal(h.ledger.rows().length, 1);
  const code = h.ledger.rows()[0].code;
  assert.equal(h.ledger.lookupFixture(code).status, 'ISSUED');
  h.restart();
  const receive = h.receiver();
  await assert.rejects(h.worker(async body => { await receive(body); throw new Error('SIMULATED_TIMEOUT'); })({ orderId: baseOrder.id }), /SIMULATED_TIMEOUT/);
  const recovered = await h.worker()({ orderId: baseOrder.id });
  assert.equal(recovered.records[0].code, code); assert.equal(recovered.records[0].status, 'PDF_READY');
  assert.equal(h.ledger.rows().length, 1);
  assert.equal(h.ledger.redeemFixture(code, 50000).balanceMinor, 250000);
  assert.equal(h.ledger.lookupFixture(code).code, code);
});

test('fresh order price/currency/products/refund/state errors cannot issue; edits after issuance require manual review', async t => {
  const h = await harness(t);
  for (const patch of [{ currency: 'EUR' }, { totalMinor: 1 }, { cancelled: true }, { refunded: true }, { discounted: true }, { cancelled: undefined },
    { items: [{ ...baseOrder.items[0], quantity: 0 }] }, { items: [{ ...baseOrder.items[0], unitAmountMinor: 1 }] }, { items: [{ ...baseOrder.items[0], productId: 'unknown' }] }]) {
    h.setOrder({ ...baseOrder, ...patch }); assert.equal((await h.worker()({ orderId: baseOrder.id })).status, 'MANUAL_REVIEW');
  }
  assert.equal(h.ledger.rows().length, 0);
  h.setOrder({ ...baseOrder, siteId: 'other-site' }); await assert.rejects(h.worker()({ orderId: baseOrder.id }), /ORDER_SCOPE_REJECTED/);
  h.setOrder(baseOrder); await h.worker()({ orderId: baseOrder.id });
  h.setOrder({ ...baseOrder, totalMinor: 600000, items: [{ ...baseOrder.items[0], quantity: 2 }] });
  await assert.rejects(h.worker()({ orderId: baseOrder.id }), /ORDER_CHANGED_MANUAL_REVIEW/);
  assert.equal(h.ledger.rows().length, 1);
});

test('signed request and response reject tampering, wrong key/site, expired time and invalid units', async t => {
  const h = await harness(t);
  const payload = { kind: 'ISSUE_UNIT_TEST', environment: 'test', siteId, orderId: baseOrder.id, lineItemId: 'line-1', productId: 'fixture-product', variantId: '3k',
    amountMinor: 300000, currency: 'CZK', paymentStatus: 'PAID', quantity: 1, unitNumber: 1, orderFingerprint: 'a'.repeat(64) };
  const signed = seal(payload, { key: h.key, now });
  for (const envelope of [{ ...signed, mac: '0'.repeat(64) }, seal(payload, { key: randomBytes(32), now }), seal(payload, { key: h.key, now: () => now() - 300001 })]) await assert.rejects(h.receiver()(envelope), /ENVELOPE_REJECTED/);
  for (const patch of [{ siteId: 'other' }, { paymentStatus: 'NOT_PAID' }, { amountMinor: 1 }, { unitNumber: 2 }, { quantity: 11 }, { currency: 'EUR' }]) await assert.rejects(h.receiver()(seal({ ...payload, ...patch }, { key: h.key, now })), /ISSUE_REQUEST_REJECTED/);
  assert.equal(h.ledger.rows().length, 0);
  await assert.rejects(h.worker(async request => {
    const response = await h.receiver()(request); return { ...response, mac: '0'.repeat(64) };
  })({ orderId: baseOrder.id }), /ENVELOPE_REJECTED/);
  assert.equal(h.ledger.rows().length, 1);
  assert.equal((await h.worker()({ orderId: baseOrder.id })).records.length, 1);
});

test('one code per unit, not one code per whole multi-quantity order', async t => {
  const h = await harness(t);
  h.setOrder({ ...baseOrder, totalMinor: 900000, items: [{ ...baseOrder.items[0], quantity: 3 }] });
  const result = await h.worker()({ orderId: baseOrder.id });
  assert.equal(new Set(result.records.map(r => r.code)).size, 3);
  await h.worker()({ orderId: baseOrder.id }); assert.equal(h.ledger.rows().length, 3);
});

test('independent processes race on the same durable key and get the same code', async t => {
  const h = await harness(t);
  const payload = { siteId, orderId: baseOrder.id, lineItemId: 'line-1', unitNumber: 1, quantity: 1, productId: 'fixture-product', variantId: '3k', amountMinor: 300000, currency: 'CZK', orderFingerprint: 'b'.repeat(64) };
  const run = () => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['integration/testing/issue-race.mjs'], { stdio: ['pipe', 'pipe', 'pipe'] });
    let output = '', errors = ''; child.stdout.on('data', b => { output += b; }); child.stderr.on('data', b => { errors += b; });
    child.on('error', reject); child.on('close', code => code ? reject(new Error(errors)) : resolve(JSON.parse(output)));
    child.stdin.end(JSON.stringify({ ...h.config, payload, validUntil: '2030-01-01' }));
  });
  const result = await Promise.all(Array.from({ length: 6 }, run));
  assert.equal(new Set(result.map(r => r.code)).size, 1); assert.equal(h.ledger.rows().length, 1);
});
