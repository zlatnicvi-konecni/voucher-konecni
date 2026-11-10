// Node-only private backend adapter. The directory/config must never come from a browser.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { originalTemplates } from './original-templates.mjs';
import { renderTestVoucherPdf } from './render-voucher.mjs';
export function createPrivateTestPdfRenderer({ directory, approvedTemplates = originalTemplates }) {
  if (typeof directory !== 'string' || !path.isAbsolute(directory)) throw new Error('PRIVATE_TEMPLATE_DIRECTORY_REQUIRED');
  return async record => {
    const known = originalTemplates[record?.amount], approved = approvedTemplates[record?.amount];
    if (!known || approved?.sha256 !== known.sha256) throw new Error('REGISTERED_ORIGINAL_REQUIRED');
    // Fixed server-owned filename, not a file/URL supplied with an order.
    const templateBytes = await readFile(path.join(directory, known.filename));
    return renderTestVoucherPdf({ record, templateBytes, approvedTemplate: approved });
  };
}
