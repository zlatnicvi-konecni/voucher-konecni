// Local/private files only. Always renders a conspicuously INVALID calibration code.
// Usage: node tools/pdf/calibrate.mjs ORIGINAL.pdf PRIVATE-LAYOUT.json NEW-OUTPUT.pdf
import { readFile, writeFile } from 'node:fs/promises';
import { renderCalibrationPdf } from './render-voucher.mjs';
const [templatePath, layoutPath, outputPath, ...extra] = process.argv.slice(2);
if (!templatePath || !layoutPath || !outputPath || extra.length) {
  console.error('Usage: calibrate.mjs ORIGINAL.pdf PRIVATE-LAYOUT.json NEW-OUTPUT.pdf');
  process.exitCode = 1;
} else {
  try {
    const templateBytes = await readFile(templatePath);
    const proposedTemplate = JSON.parse(await readFile(layoutPath, 'utf8'));
    const result = await renderCalibrationPdf({ templateBytes, proposedTemplate });
    // Exclusive creation: cannot overwrite the original, a prior PDF or a symlink target.
    await writeFile(outputPath, result, { flag: 'wx', mode: 0o600 });
    console.log('Invalid calibration PDF saved. No registry writes or email.');
  } catch (_) {
    console.error('Calibration failed. Check private input, layout/hash and a new output path.');
    process.exitCode = 1;
  }
}
