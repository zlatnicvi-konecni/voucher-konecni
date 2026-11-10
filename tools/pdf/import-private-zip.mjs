// Read-only input archive; originals may only be extracted OUTSIDE the public checkout.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { originalTemplates } from './original-templates.mjs';
const [archive, directory, ...extra] = process.argv.slice(2);
if (!archive || !directory || extra.length) {
  console.error('Usage: import-private-zip.mjs PRIVATE.zip PRIVATE_DIRECTORY'); process.exitCode = 1;
} else {
  try {
    execFileSync('python', ['-c', `
import sys,pathlib,json,zipfile,hashlib,os
archive,out,repo,manifest=sys.argv[1:];out=pathlib.Path(out).resolve();repo=pathlib.Path(repo).resolve()
if out==repo or repo in out.parents: raise ValueError('Private directory must be outside public checkout')
records=json.loads(manifest);verified=[]
with zipfile.ZipFile(archive) as z:
 for entry in records:
  matches=[i for i in z.infolist() if i.filename==entry['archiveName']]
  if len(matches)!=1 or matches[0].file_size>30*1024*1024: raise ValueError('Unexpected archive entry')
  data=z.read(matches[0])
  if hashlib.sha256(data).hexdigest()!=entry['sha256']: raise ValueError('Original hash mismatch')
  verified.append((entry['filename'],data))
out.mkdir(parents=True,exist_ok=True,mode=0o700)
for name,data in verified:
 target=out/name
 if target.is_symlink(): raise ValueError('Symlink rejected')
 if target.exists():
  if target.read_bytes()!=data: raise ValueError('Existing original differs')
 else:
  fd=os.open(target,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
  with os.fdopen(fd,'wb') as f:f.write(data)
`, path.resolve(archive), path.resolve(directory), path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'), JSON.stringify(Object.values(originalTemplates))], { stdio: 'pipe' });
    console.log('Verified all three private originals. No assets added to public checkout.');
  } catch (_) { console.error('Private import rejected: check archive, hashes and destination outside the public checkout.'); process.exitCode = 1; }
}
