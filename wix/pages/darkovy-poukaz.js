// Native Wix page code. Uses the existing site shell and original photo.
// This draft does not navigate, create orders, issue vouchers or send email.
import { prepareVoucherCheckout } from 'backend/voucherCheckout.web';
import { validateSelection } from 'public/voucher-model';
$w.onReady(() => {
  let busy = false;
  const controls = ['#voucherAmount', '#voucherQuantity', '#recipientType', '#recipientName', '#recipientEmail', '#privacyAcknowledged'];
  const lockControls = [...controls, '#quantityMinus', '#quantityPlus'];
  const clear = () => { $w('#voucherStatus').text = ''; };
  function syncQuantity() {
    const count = Number($w('#voucherQuantity').value);
    if (busy || count <= 1) $w('#quantityMinus').disable(); else $w('#quantityMinus').enable();
    if (busy || count >= 10) $w('#quantityPlus').disable(); else $w('#quantityPlus').enable();
  }
  function syncRecipient() {
    clear();
    const self = $w('#recipientType').value === 'self';
    $w('#recipientEmail').required = !self;
    if (self) {
      $w('#recipientEmail').value = '';
      $w('#recipientName').value = '';
      $w('#recipientFields').collapse();
    } else $w('#recipientFields').expand();
  }
  function syncPrice() {
    clear();
    const amount = Number($w('#voucherAmount').value);
    $w('#voucherPrice').text = new Intl.NumberFormat('cs-CZ').format(amount) + ' Kč';
  }
  controls.forEach(id => $w(id).onChange(clear));
  ['#recipientName', '#recipientEmail', '#voucherQuantity'].forEach(id => $w(id).onInput(clear));
  $w('#recipientType').onChange(syncRecipient);
  $w('#voucherAmount').onChange(syncPrice);
  $w('#voucherQuantity').onChange(() => { clear(); syncQuantity(); });
  $w('#voucherQuantity').onInput(() => { clear(); syncQuantity(); });
  for (const [id, step] of [['#quantityMinus', -1], ['#quantityPlus', 1]]) $w(id).onClick(() => {
    if (busy) return;
    const count = Number($w('#voucherQuantity').value);
    $w('#voucherQuantity').value = String(Math.max(1, Math.min(10, (Number.isInteger(count) ? count : 1) + step)));
    clear();
    syncQuantity();
  });
  syncRecipient();
  syncPrice();
  syncQuantity();
  $w('#continueCheckout').onClick(async () => {
    if (busy) return;
    clear();
    busy = true;
    lockControls.forEach(id => $w(id).disable());
    $w('#continueCheckout').disable();
    try {
      const selection = validateSelection({ amount: Number($w('#voucherAmount').value),
        quantity: Number($w('#voucherQuantity').value), recipientType: $w('#recipientType').value,
        recipientName: $w('#recipientName').value, recipientEmail: $w('#recipientEmail').value,
        privacyAcknowledged: $w('#privacyAcknowledged').checked });
      const result = await prepareVoucherCheckout(selection);
      $w('#voucherStatus').text = result?.message || 'Pokladna zatím není připojena.';
    } catch (_) {
      $w('#voucherStatus').text = 'Zkontrolujte povinné údaje. Pokud problém trvá, zkuste to později.';
    } finally {
      busy = false;
      lockControls.forEach(id => $w(id).enable());
      syncQuantity();
      $w('#continueCheckout').enable();
    }
  });
});
