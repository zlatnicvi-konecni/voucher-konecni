const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

function setup() {
  const nodes = {};
  const listeners = {};
  const ids = ['onlineVoucherForm', 'onlineVouchers', 'onlineFields', 'onlineMessage',
    'onlineOrder', 'onlineLine', 'onlineUnit', 'onlineAmount', 'onlineEmail',
    'onlineIssuer', 'onlinePin', 'onlinePaid'];
  for (const id of ids) nodes[id] = { value: '', textContent: '', checked: false };
  nodes.onlineVoucherForm.addEventListener = (type, fn) => { listeners[type] = fn; };
  nodes.onlineVoucherForm.reset = () => {
    for (const id of ids.slice(4)) { nodes[id].value = ''; nodes[id].checked = false; }
    listeners.reset?.();
  };
  nodes.onlineVoucherForm.reportValidity = () => true;
  const context = { document: { getElementById: id => nodes[id] }, window: {} };
  // Deliberately no fetch, storage, legacy API or console in the VM.
  vm.runInNewContext(fs.readFileSync('online-vouchers.js', 'utf8'), context);
  return { nodes, api: context.window.onlineVoucherMock,
    submit: () => listeners.submit({ preventDefault() {} }) };
}

test('locked by default and cleared on loss of authorization', () => {
  const { nodes: n, api, submit } = setup();
  assert.equal(n.onlineVouchers.hidden, true);
  assert.equal(n.onlineFields.disabled, true);
  submit();
  assert.equal(n.onlineMessage.textContent, '');
  api.setAuthorized(true);
  assert.equal(n.onlineVouchers.hidden, false);
  n.onlineEmail.value = 'example';
  n.onlinePin.value = 'dummy';
  api.setAuthorized(false);
  assert.equal(n.onlineEmail.value, '');
  assert.equal(n.onlinePin.value, '');
  assert.equal(n.onlineFields.disabled, true);
});

test('format check requires confirmation and safe positive integers, never issues', () => {
  const { nodes: n, api, submit } = setup();
  api.setAuthorized(true);
  for (const id of ['onlineOrder', 'onlineLine', 'onlineIssuer', 'onlinePin']) n[id].value = 'dummy';
  n.onlineAmount.value = '1500';
  n.onlineUnit.value = '1';
  submit();
  assert.match(n.onlineMessage.textContent, /potvrďte/);
  n.onlinePaid.checked = true;
  for (const invalid of ['-1', '0', '1.5', 'Infinity', '9007199254740992']) {
    n.onlineAmount.value = invalid;
    submit();
    assert.match(n.onlineMessage.textContent, /kladnou/);
  }
  n.onlineAmount.value = '1500';
  submit();
  assert.match(n.onlineMessage.textContent, /poukaz nebyl vydán/);
  assert.equal(n.onlinePin.value, '');
  submit();
  assert.match(n.onlineMessage.textContent, /Vyplňte/);
});
