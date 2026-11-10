import { validateSelection } from '../public/voucher-model.mjs';
const form = document.querySelector('#form'), status = document.querySelector('#status');
for (const event of ['input', 'change', 'invalid']) form.addEventListener(event, () => { status.textContent = ''; }, true);
form.addEventListener('submit', event => {
  event.preventDefault();
  try {
    validateSelection({ amount: Number(form.amount.value), recipientName: form.recipientName.value,
      recipientEmail: form.recipientEmail.value, senderName: form.senderName.value,
      message: form.message.value, privacyAcknowledged: form.privacy.checked });
    status.textContent = 'Pokladna není připojena. Objednávka ani poukaz nebyly vytvořeny.';
  } catch (error) { status.textContent = error.message; }
});
