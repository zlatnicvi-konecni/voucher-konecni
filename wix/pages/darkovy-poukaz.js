// Native Wix page code. Uses the existing site shell and original photo.
// This draft does not navigate, create orders, issue vouchers or send email.
import { prepareVoucherCheckout } from 'backend/voucherCheckout.web';
import { validateSelection, deliveryTimeOptions, pragueDate } from 'public/voucher-model';
$w.onReady(() => {
  let busy = false;
  const controls = ['#voucherAmount', '#voucherQuantity', '#recipientType', '#recipientName', '#recipientEmail', '#giftMessage', '#deliveryDate', '#deliveryTime'];
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
      $w('#giftMessage').value = '';
      $w('#deliveryDate').value = undefined;
      $w('#deliveryTime').value = 'now';
      $w('#recipientFields').collapse();
    } else {
      $w('#recipientFields').expand();
      if (!$w('#deliveryDate').value) {
        const [year, month, day] = pragueDate().split('-').map(Number);
        $w('#deliveryDate').value = new Date(year, month - 1, day);
      }
      syncDeliveryTimes();
    }
  }
  function dateValue() {
    const date = $w('#deliveryDate').value;
    if (!date) return null;
    if (!Number.isFinite(date.getTime())) return 'invalid';
    return String(date.getFullYear()).padStart(4, '0') + '-' + String(date.getMonth()+1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
  }
  function syncDeliveryTimes() {
    const selected = $w('#deliveryTime').value;
    const options = deliveryTimeOptions(dateValue());
    $w('#deliveryTime').options = options;
    $w('#deliveryTime').value = options.some(o => o.value === selected) ? selected : 'now';
  }
  function syncPrice() {
    clear();
    const amount = Number($w('#voucherAmount').value);
    $w('#voucherPrice').text = new Intl.NumberFormat('cs-CZ').format(amount) + ' Kč';
  }
  controls.forEach(id => $w(id).onChange(clear));
  ['#recipientName', '#recipientEmail', '#voucherQuantity', '#giftMessage'].forEach(id => $w(id).onInput(clear));
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
  $w('#deliveryDate').onChange(() => { clear(); syncDeliveryTimes(); });
  $w('#descriptionFull').collapse();
  $w('#descriptionSummary').expand();
  $w('#descriptionToggle').label = 'Zjistit více';
  $w('#descriptionToggle').onClick(() => {
    if ($w('#descriptionFull').collapsed) { $w('#descriptionFull').expand(); $w('#descriptionSummary').collapse(); $w('#descriptionToggle').label = 'Méně'; }
    else { $w('#descriptionFull').collapse(); $w('#descriptionSummary').expand(); $w('#descriptionToggle').label = 'Zjistit více'; }
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
        message: $w('#giftMessage').value, requestedDeliveryDate: dateValue(), requestedDeliveryTime: $w('#deliveryTime').value });
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
