import { validateSelection } from '../public/voucher-model.mjs';
const form = document.querySelector('#form'), status = document.querySelector('#status');
const value = name => form.querySelector(`input[name="${name}"]:checked`).value;
const quantity = document.querySelector('#quantity');
function sync() {
  document.querySelector('#price').textContent = new Intl.NumberFormat('cs-CZ').format(Number(value('amount'))) + ' Kč';
  const self = value('recipientType') === 'self';
  document.querySelector('#recipientFields').hidden = self;
  document.querySelector('#selfNote').hidden = !self;
  for (const id of ['recipientEmail', 'recipientName']) {
    const input = document.querySelector('#' + id);
    input.disabled = self;
    if (self) input.value = '';
  }
  document.querySelector('#recipientEmail').required = !self;
  document.querySelector('#minus').disabled = Number(quantity.value) <= 1;
  document.querySelector('#plus').disabled = Number(quantity.value) >= 10;
}
for (const event of ['input', 'change', 'invalid']) form.addEventListener(event, () => { status.textContent = ''; }, true);
form.addEventListener('change', sync);
quantity.addEventListener('input', sync);
for (const [id, step] of [['minus', -1], ['plus', 1]]) document.querySelector('#' + id).addEventListener('click', () => {
  const current = Number(quantity.value);
  quantity.value = Math.max(1, Math.min(10, (Number.isInteger(current) ? current : 1) + step));
  quantity.dispatchEvent(new Event('input', { bubbles: true }));
});
document.querySelector('#more').addEventListener('click', event => {
  const expanded = event.currentTarget.getAttribute('aria-expanded') === 'true';
  event.currentTarget.setAttribute('aria-expanded', String(!expanded));
  document.querySelector('#descriptionMore').hidden = expanded;
});
form.addEventListener('submit', event => {
  event.preventDefault();
  try {
    validateSelection({ amount: Number(value('amount')), quantity: Number(quantity.value), recipientType: value('recipientType'),
      recipientName: form.recipientName.value, recipientEmail: form.recipientEmail.value,
      privacyAcknowledged: form.privacy.checked });
    status.textContent = 'Pokladna není připojena. Objednávka ani poukaz nebyly vytvořeny.';
  } catch (error) { status.textContent = error.message; }
});
sync();
