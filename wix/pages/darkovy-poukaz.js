// Native Wix page code, not an HTML embed or an external app.
// Element IDs and setup are documented in docs/WIX_B0_HANDOFF.md.
import { prepareVoucherCheckout } from 'backend/voucherCheckout.web';
import { validateSelection } from 'public/voucher-model';
$w.onReady(() => {
  let busy = false;
  const controls = ['#voucherAmount', '#recipientName', '#recipientEmail', '#senderName', '#giftMessage', '#privacyAcknowledged'];
  const clear = () => { $w('#voucherStatus').text = ''; };
  controls.forEach(id => $w(id).onChange(clear));
  ['#recipientName', '#recipientEmail', '#senderName', '#giftMessage'].forEach(id => $w(id).onInput(clear));
  $w('#continueCheckout').onClick(async () => {
    if (busy) return;
    clear();
    busy = true;
    $w('#continueCheckout').disable();
    try {
      const selection = validateSelection({ amount: Number($w('#voucherAmount').value),
        recipientName: $w('#recipientName').value, recipientEmail: $w('#recipientEmail').value,
        senderName: $w('#senderName').value, message: $w('#giftMessage').value,
        privacyAcknowledged: $w('#privacyAcknowledged').checked });
      const result = await prepareVoucherCheckout(selection);
      $w('#voucherStatus').text = result?.message || 'Pokladna zatím není připojena.';
      // No URL from client or backend is followed in B0.
    } catch (_) {
      $w('#voucherStatus').text = 'Zkontrolujte povinné údaje. Pokud problém trvá, zkuste to později.';
    } finally {
      busy = false;
      $w('#continueCheckout').enable();
    }
  });
});
