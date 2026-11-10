// Optional private acceptance check: originals/layouts are never committed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { PNG } from 'pngjs';
import jsQR from 'jsqr';
import { renderCalibrationPdf } from '../render-voucher.mjs';

test('private original: dimensions, front/outside pixels, text and decoded QR', {
  skip: !process.env.ORIGINAL_PDF || !process.env.PDF_LAYOUT
}, async () => {
  const source = path.resolve(process.env.ORIGINAL_PDF);
  const manifest = path.resolve(process.env.PDF_LAYOUT);
  const proposedTemplate = JSON.parse(await readFile(manifest, 'utf8'));
  await mkdir('work', { recursive: true });
  const dir = await mkdtemp(path.resolve('work', 'private-calibration-'));
  try {
    const result = await renderCalibrationPdf({ templateBytes: await readFile(source), proposedTemplate });
    const output = path.join(dir, 'invalid-calibration.pdf');
    await writeFile(output, result, { mode: 0o600 });
    execFileSync('python', ['-c', `
import sys,json,fitz
from PIL import Image,ImageDraw,ImageChops
source,output,manifest,image=sys.argv[1:]
a=fitz.open(source);b=fitz.open(output);config=json.load(open(manifest));layout=config['layout']
assert len(a)==len(b)==2
for i in range(2):
 assert abs(b[i].rect.width*25.4/72-170)<.01 and abs(b[i].rect.height*25.4/72-120)<.01
 pa=a[i].get_pixmap(dpi=300);pb=b[i].get_pixmap(dpi=300)
 assert (pa.width,pa.height)==(pb.width,pb.height)
 ia=Image.frombytes('RGB',(pa.width,pa.height),pa.samples);ib=Image.frombytes('RGB',(pb.width,pb.height),pb.samples)
 diff=ImageChops.difference(ia,ib)
 if i==1:
  mask=Image.new('L',ia.size,0);draw=ImageDraw.Draw(mask);s=300/25.4
  for field in ['qr','code','expiry']:
   r=layout[field];draw.rectangle((int(r['x']*s)-2,int((120-r['y']-r['height'])*s)-2,int((r['x']+r['width'])*s)+2,int((120-r['y'])*s)+2),fill=255)
  diff.paste((0,0,0),(0,0),mask);ib.save(image)
  assert 'TEST-NEPLATNY-'+str(config['amount']) in b[i].get_text()
  assert '10.11.2028' in b[i].get_text()
 assert diff.getbbox() is None
`, source, output, manifest, path.join(dir, 'scan.png')], { cwd: dir, stdio: 'pipe' });
    const png = PNG.sync.read(await readFile(path.join(dir, 'scan.png')));
    const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
    assert.equal(decoded?.data, `TEST-NEPLATNY-${proposedTemplate.amount}`);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
