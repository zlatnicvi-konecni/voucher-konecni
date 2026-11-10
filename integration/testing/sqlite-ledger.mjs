// LOCAL TEST STORE ONLY, deliberately not a Google Sheets schema or production issuer.
import { DatabaseSync } from 'node:sqlite';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import path from 'node:path';
export class SqliteTestLedger {
  environment = 'test';
  constructor({ databasePath, testRoot }) {
    if (!testRoot || !path.resolve(databasePath).startsWith(path.resolve(testRoot) + path.sep)) throw new Error('LOCAL_TEST_PATH_REQUIRED');
    this.db = new DatabaseSync(databasePath);
    this.db.exec(`PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, fingerprint TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS vouchers (unit_key TEXT PRIMARY KEY, order_fingerprint TEXT NOT NULL,
        immutable TEXT NOT NULL, voucher_id TEXT UNIQUE NOT NULL, code TEXT UNIQUE NOT NULL,
        amount_minor INTEGER NOT NULL, balance_minor INTEGER NOT NULL, valid_until TEXT NOT NULL,
        pdf BLOB, pdf_sha TEXT);`);
  }
  close() { this.db.close(); }
  transaction(fn) {
    this.db.exec('BEGIN IMMEDIATE');
    try { const result = fn(); this.db.exec('COMMIT'); return result; }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  record(row) {
    return { environment: 'test', paymentConfirmed: true, voucherId: row.voucher_id, code: row.code,
      amount: row.amount_minor / 100, currency: 'CZK', balanceMinor: row.balance_minor,
      validUntil: row.valid_until, status: row.pdf ? 'PDF_READY' : 'ISSUED', pdfSha256: row.pdf_sha };
  }
  issueOnce(p, validUntil) {
    return this.transaction(() => {
      const orderKey = JSON.stringify([p.siteId, p.orderId]);
      const order = this.db.prepare('SELECT fingerprint FROM orders WHERE id=?').get(orderKey);
      if (order && order.fingerprint !== p.orderFingerprint) throw new Error('ORDER_CHANGED_MANUAL_REVIEW');
      this.db.prepare('INSERT OR IGNORE INTO orders VALUES (?,?)').run(orderKey, p.orderFingerprint);
      const unitKey = JSON.stringify([p.siteId, p.orderId, p.lineItemId, p.unitNumber]);
      const immutable = JSON.stringify([p.productId, p.variantId, p.quantity, p.amountMinor, p.currency]);
      let row = this.db.prepare('SELECT * FROM vouchers WHERE unit_key=?').get(unitKey);
      if (row && row.immutable !== immutable) throw new Error('UNIT_CHANGED_MANUAL_REVIEW');
      if (!row) {
        // Test codes are never registered with a real voucher system.
        const code = 'TEST-' + randomBytes(4).toString('hex').toUpperCase();
        this.db.prepare('INSERT INTO vouchers VALUES (?,?,?,?,?,?,?,?,NULL,NULL)').run(unitKey, p.orderFingerprint, immutable,
          randomUUID(), code, p.amountMinor, p.amountMinor, validUntil);
        row = this.db.prepare('SELECT * FROM vouchers WHERE unit_key=?').get(unitKey);
      }
      return this.record(row);
    });
  }
  savePdfOnce(id, bytes) {
    if (!(bytes instanceof Uint8Array) || !bytes.length) throw new Error('PDF_BYTES_REQUIRED');
    return this.transaction(() => {
      this.db.prepare('UPDATE vouchers SET pdf=?,pdf_sha=? WHERE voucher_id=? AND pdf IS NULL').run(bytes, createHash('sha256').update(bytes).digest('hex'), id);
      const row = this.db.prepare('SELECT * FROM vouchers WHERE voucher_id=?').get(id);
      if (!row) throw new Error('UNKNOWN_VOUCHER');
      return this.record(row);
    });
  }
  rows() { return this.db.prepare('SELECT * FROM vouchers ORDER BY unit_key').all(); }
  // Fixture-only lookup/redeem, no public endpoint and no claim of production PIN/auth.
  lookupFixture(code) { const row = this.db.prepare('SELECT * FROM vouchers WHERE code=?').get(code); return row ? this.record(row) : null; }
  redeemFixture(code, amountMinor) {
    if (!Number.isSafeInteger(amountMinor) || amountMinor < 1) throw new Error('AMOUNT_REJECTED');
    return this.transaction(() => {
      const row = this.db.prepare('SELECT * FROM vouchers WHERE code=?').get(code);
      if (!row || row.balance_minor < amountMinor) throw new Error('BALANCE_REJECTED');
      this.db.prepare('UPDATE vouchers SET balance_minor=balance_minor-? WHERE code=?').run(amountMinor, code);
      return this.lookupFixture(code);
    });
  }
}
