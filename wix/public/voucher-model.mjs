// Shared validation, never an authority for checkout pricing or payment.
export const VALUES = Object.freeze([3000, 5000, 10000]);
export function validateSelection(input) {
  if (!input || !VALUES.includes(input.amount)) throw new Error('Vyberte hodnotu poukazu.');
  const recipientName = String(input.recipientName ?? '').trim();
  const recipientEmail = String(input.recipientEmail ?? '').trim();
  const senderName = String(input.senderName ?? '').trim();
  const message = String(input.message ?? '').trim();
  if (!recipientName || recipientName.length > 100 || !senderName || senderName.length > 100) throw new Error('Vyplňte jméno příjemce a odesílatele.');
  if (recipientEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) throw new Error('Zkontrolujte e-mail příjemce.');
  if (message.length > 500) throw new Error('Věnování může mít nejvýše 500 znaků.');
  if (input.privacyAcknowledged !== true) throw new Error('Potvrďte seznámení se zpracováním údajů.');
  return { amount: input.amount, recipientName, recipientEmail, senderName, message, privacyAcknowledged: true };
}
