import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink, access } from 'node:fs/promises';
import { execFileSync, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { originalTemplates } from '../original-templates.mjs';
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const cli = path.join(repo, 'tools/pdf/import-private-zip.mjs');
const optimized = { ...process.env, PYTHONOPTIMIZE: '1' };
const run = (archive, destination) => spawnSync(process.execPath, [cli, archive, destination], { env: optimized, encoding: 'utf8' });

test('private importer rejects counterfeit bytes even when Python assertions are disabled', async () => {
  const root = await mkdtemp(path.resolve(repo, '..', 'import-guard-'));
  try {
    const archive = path.join(root, 'counterfeit.zip');
    execFileSync('python', ['-c', `import sys,json,zipfile
with zipfile.ZipFile(sys.argv[1],'w') as z:
 for name in json.loads(sys.argv[2]):z.writestr(name,b'NOT A PRIVATE PDF')`, archive, JSON.stringify(Object.values(originalTemplates).map(t => t.archiveName))]);
    const destination = path.join(root, 'outside-public');
    assert.notEqual(run(archive, destination).status, 0);
    await assert.rejects(access(destination));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('private importer with optimization: valid SHA succeeds privately, public destination and symlinks rejected', {
  skip: !process.env.VOUCHER_ORIGINALS_DIR
}, async () => {
  const root = await mkdtemp(path.resolve(repo, '..', 'import-original-'));
  const publicDestination = path.join(repo, 'work', 'guard-' + path.basename(root));
  try {
    const archive = path.join(root, 'originals.zip');
    execFileSync('python', ['-c', `import sys,json,zipfile,pathlib
with zipfile.ZipFile(sys.argv[1],'w') as z:
 for t in json.loads(sys.argv[3]):z.write(pathlib.Path(sys.argv[2])/t['filename'],t['archiveName'])`, archive, path.resolve(process.env.VOUCHER_ORIGINALS_DIR), JSON.stringify(Object.values(originalTemplates))]);
    assert.notEqual(run(archive, publicDestination).status, 0);
    await assert.rejects(access(publicDestination));
    const destination = path.join(root, 'private');
    assert.equal(run(archive, destination).status, 0);
    for (const template of Object.values(originalTemplates)) {
      const bytes = await readFile(path.join(destination, template.filename));
      assert.equal(createHash('sha256').update(bytes).digest('hex'), template.sha256);
    }
    assert.equal(run(archive, destination).status, 0, 'identical existing originals are accepted');
    const linkDestination = path.join(root, 'private-links'); await mkdir(linkDestination);
    const sentinel = path.join(root, 'sentinel'); await writeFile(sentinel, 'unchanged');
    await symlink(sentinel, path.join(linkDestination, originalTemplates[3000].filename));
    assert.notEqual(run(archive, linkDestination).status, 0);
    assert.equal(await readFile(sentinel, 'utf8'), 'unchanged');
  } finally { await rm(root, { recursive: true, force: true }); await rm(publicDestination, { recursive: true, force: true }); }
});
