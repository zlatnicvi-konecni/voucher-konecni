// Child-process fixture for proving cross-process atomicity in the LOCAL test store.
import { SqliteTestLedger } from './sqlite-ledger.mjs';
let input = '';
for await (const chunk of process.stdin) input += chunk;
const config = JSON.parse(input);
const ledger = new SqliteTestLedger(config);
try { process.stdout.write(JSON.stringify(ledger.issueOnce(config.payload, config.validUntil))); }
finally { ledger.close(); }
