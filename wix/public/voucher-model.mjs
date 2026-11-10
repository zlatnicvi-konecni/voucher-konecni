// Shared draft validation. Neither prices in a browser nor delivery preferences prove payment.
export const VALUES = Object.freeze([3000, 5000, 10000]);
export function pragueDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Prague', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = name => parts.find(p => p.type === name).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export function deliveryTimeOptions(date, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Prague', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const minute = Number(parts.find(p => p.type === 'hour').value) * 60 + Number(parts.find(p => p.type === 'minute').value);
  const options = [{ label: 'Nyní', value: 'now' }];
  for (let n = 0; n < 1440; n += 15) if (date !== pragueDate(now) || n > minute) {
    const value = String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0');
    options.push({ label: value, value });
  }
  return options;
}
export function validateSelection(input) {
  if (!input || !VALUES.includes(input.amount)) throw new Error('Vyberte hodnotu poukazu.');
  const quantity = input.quantity ?? 1, recipientType = input.recipientType ?? 'other';
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 10) throw new Error('Vyberte množství od 1 do 10.');
  if (!['other', 'self'].includes(recipientType)) throw new Error('Vyberte příjemce poukazu.');
  const self = recipientType === 'self';
  const recipientName = self ? '' : String(input.recipientName ?? '').trim();
  const recipientEmail = self ? '' : String(input.recipientEmail ?? '').trim();
  const message = self ? '' : String(input.message ?? '').trim();
  const requestedDeliveryDate = self ? null : input.requestedDeliveryDate ?? null;
  const requestedDeliveryTime = self ? 'now' : input.requestedDeliveryTime ?? 'now';
  if (recipientName.length > 50) throw new Error('Jméno může mít nejvýše 50 znaků.');
  if (!self && (recipientEmail.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail))) throw new Error('Zkontrolujte e-mail příjemce.');
  if (message.length > 500) throw new Error('Zpráva může mít nejvýše 500 znaků.');
  if (requestedDeliveryDate !== null) {
    if (typeof requestedDeliveryDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(requestedDeliveryDate)) throw new Error('Zkontrolujte datum doručení.');
    const date = new Date(requestedDeliveryDate + 'T00:00:00.000Z');
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== requestedDeliveryDate || requestedDeliveryDate < pragueDate()) throw new Error('Zkontrolujte datum doručení.');
  }
  if (requestedDeliveryTime !== 'now' && (!requestedDeliveryDate || !/^(?:[01]\d|2[0-3]):(?:00|15|30|45)$/.test(requestedDeliveryTime))) throw new Error('Zkontrolujte čas doručení.');
  if (requestedDeliveryTime !== 'now' && !deliveryTimeOptions(requestedDeliveryDate).some(option => option.value === requestedDeliveryTime)) throw new Error('Zkontrolujte čas doručení.');
  return { amount: input.amount, quantity, recipientType, recipientName, recipientEmail, message, requestedDeliveryDate, requestedDeliveryTime };
}
