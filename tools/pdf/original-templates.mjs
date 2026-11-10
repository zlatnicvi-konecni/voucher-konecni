// Public metadata only. PDF bytes stay in the authorized PRIVATE repository.
// Approvals are deliberately false until the owner completes physical print acceptance.
const template = (amount, filename, archiveName, sha256, fontSizePt) => ({ amount, filename, archiveName, sha256,
  layout: { page: 2, units: 'mm-bottom-left', visualApproved: false, printApproved: false,
    qr: { x: 21, y: 21, width: 18, height: 18 },
    code: { x: 21, y: 15, width: 35, height: 4.2, fontSizePt },
    expiry: { x: 76, y: 16, width: 28, height: 5, fontSizePt: 9 } } });
const deepFreeze = object => { Object.values(object).filter(value => value && typeof value === 'object').forEach(deepFreeze); return Object.freeze(object); };
export const originalTemplates = deepFreeze({
  3000: template(3000, '3000_darkovy poukaz_edit1.pdf', 'voucher_3000.pdf', '6899fdebd0f0f027509ffe00e7af37ec91fcfd0dbcd71674ed8cd081663f177d', 9),
  5000: template(5000, '5000_darkovy poukaz_edit1.pdf', 'voucher_5000.pdf', 'd0ac7b6fcbcf38d928156437a77226538ef403c823f34ce6866984b0b70f368c', 9),
  10000: template(10000, '10000_darkovy poukaz_edit.pdf', 'voucher_10000.pdf', '414390e665b0de0a1c77dc1dcd1821419de761ce249ec2788e258e92c2c9ba2d', 8.5)
});
