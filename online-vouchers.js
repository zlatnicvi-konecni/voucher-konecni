/* Phase 1: disconnected UI only. Never send these fields to the legacy API. */
(() => {
  'use strict';
  const form = document.getElementById('onlineVoucherForm');
  const section = document.getElementById('onlineVouchers');
  const fields = document.getElementById('onlineFields');
  const message = document.getElementById('onlineMessage');
  let authorized = false;

  function setAuthorized(value) {
    authorized = value === true;
    section.hidden = !authorized;
    fields.disabled = !authorized;
    if (!authorized) {
      form.reset();
      message.textContent = '';
    }
  }

  form.addEventListener('reset', () => { message.textContent = ''; });
  form.addEventListener('submit', event => {
    event.preventDefault();
    message.textContent = '';
    if (!authorized || !form.reportValidity()) return;
    const value = id => document.getElementById(id).value.trim();
    const amount = Number(value('onlineAmount'));
    const unit = Number(value('onlineUnit'));
    if (!value('onlineOrder') || !value('onlineLine') || !value('onlineIssuer') ||
        !value('onlinePin') || !Number.isSafeInteger(amount) || amount < 1 ||
        !Number.isSafeInteger(unit) || unit < 1 ||
        !document.getElementById('onlinePaid').checked) {
      message.textContent = 'Vyplňte identifikaci, kladnou celočíselnou hodnotu a kus a potvrďte platbu.';
      return;
    }
    // No persistence, network, voucher code, PDF or claim of verified payment.
    document.getElementById('onlinePin').value = '';
    message.textContent = 'Lokální kontrola formátu dokončena. Platba ani PIN nebyly ověřeny. Backend není připojen; poukaz nebyl vydán.';
  });

  window.onlineVoucherMock = Object.freeze({ setAuthorized });
  setAuthorized(false);
})();
