// Offline proof of the server-to-server protocol. No endpoint or credentials.
import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto';
const fail = reason => { throw new Error(reason); };
function keyCheck(key) { if (!(key instanceof Uint8Array) || key.length < 32) fail('TEST_KEY_REQUIRED'); }
export function seal(payload, { key, now = Date.now, nonce = randomUUID }) {
  keyCheck(key);
  const envelope = { version: 1, timestamp: now(), nonce: nonce(), payload: Buffer.from(JSON.stringify(payload)).toString('base64url') };
  envelope.mac = createHmac('sha256', key).update(`${envelope.version}.${envelope.timestamp}.${envelope.nonce}.${envelope.payload}`).digest('hex');
  return envelope;
}
export function open(envelope, { key, now = Date.now }) {
  keyCheck(key);
  if (!envelope || envelope.version !== 1 || !Number.isSafeInteger(envelope.timestamp) || Math.abs(now() - envelope.timestamp) > 300000 || typeof envelope.nonce !== 'string' || !/^[a-zA-Z0-9-]{8,100}$/.test(envelope.nonce) || typeof envelope.payload !== 'string' || envelope.payload.length > 16000 || !/^[A-Za-z0-9_-]+$/.test(envelope.payload) || !/^[a-f0-9]{64}$/.test(envelope.mac ?? '')) fail('ENVELOPE_REJECTED');
  const mac = createHmac('sha256', key).update(`${envelope.version}.${envelope.timestamp}.${envelope.nonce}.${envelope.payload}`).digest();
  if (!timingSafeEqual(mac, Buffer.from(envelope.mac, 'hex'))) fail('ENVELOPE_REJECTED');
  let payload;
  try { payload = JSON.parse(Buffer.from(envelope.payload, 'base64url').toString('utf8')); } catch { fail('ENVELOPE_REJECTED'); }
  if (payload?.environment !== 'test') fail('TEST_ONLY');
  return payload;
}
