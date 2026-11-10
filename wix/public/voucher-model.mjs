// Shared validation, never an authority for checkout pricing or payment.
export const VALUES = Object.freeze([3000, 5000, 10000]);
export function validateSelection(input) {
  if (!input || !VALUES.includes(input.amount)) throw new Error('Vyberte hodnotu poukazu.');
  const quantity = input.quantity ?? 1;
  const recipientType = input.recipientType ?? 'other';
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 10) throw new Error('Vyberte množství od 1 do 10.');
  if (!['other', 'self'].includes(recipientType)) throw new Error('Vyberte příjemce poukazu.');
  // Self gifts must later use the server-verified checkout customer, never a stale
  // hidden recipient or a client-supplied buyer identity.
  const recipientName = recipientType === 'self' ? '' : String(input.recipientName ?? '').trim();
  const recipientEmail = recipientType === 'self' ? '' : String(input.recipientEmail ?? '').trim();
  const senderName = String(input.senderName ?? '').trim();
  const message = String(input.message ?? '').trim();
  if (recipientName.length > 100 || senderName.length > 100) throw new Error('Jméno může mít nejvýše 100 znaků.');
  if (recipientType === 'other' && (recipientEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail))) throw new Error('Zkontrolujte e-mail příjemce.');
  if (message.length > 500) throw new Error('Věnování může mít nejvýše 500 znaků.');
  if (input.privacyAcknowledged !== true) throw new Error('Potvrďte seznámení se zpracováním údajů.');
  return { amount: input.amount, quantity, recipientType, recipientName, recipientEmail, senderName, message, privacyAcknowledged: true };
}
