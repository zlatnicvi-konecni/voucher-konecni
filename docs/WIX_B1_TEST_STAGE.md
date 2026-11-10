# PR #3 — další testovací etapa Wix → Apps Script → evidence → PDF

## Rozsah a hranice

Implementován spustitelný OFFLINE kontrakt propojení. Neexistuje nový veřejný
endpoint, aktivní `events.js`, HTTP klient do Apps Scriptu ani připojená Google
Sheet. `prepareVoucherCheckout` stále vrací `available:false`. Nic se zde
nenasazuje a není dovoleno použít produkční Wix objednávku nebo evidenci.

| Část | Co opravdu běží v testu | Co ještě musí dodat izolované prostředí |
| --- | --- | --- |
| Wix payment event | Trigger s orderId a vždy nové čtení serverovým adaptérem | Skutečný testovací Wix event a autentizované Get Order + normalizace |
| Wix → Apps Script | HMAC-SHA256 obálka požadavku i odpovědi; loopback transport | Autorizovaný HTTPS testovací deployment, Wix Secrets / ScriptProperties |
| Apps Script | Node implementace testovacího přijímacího kontraktu | Adaptér do existující testovací autorizační/emisní logiky |
| Sheets | Oddělený lokální SQLite test store s transakcí a unikátním klíčem | Skutečné schéma testovací evidence, LockService a dohledatelná atomická emise |
| PDF | Skutečný renderer + všechny 3 skutečné soukromé předlohy | Fyzický tisk, schválení layoutu a soukromé úložiště testovacího backendu |

SQLite je testovací náhrada, nikoli nový navrhovaný produkční registr voucherů.
Jeho transakční test NEDOKAZUJE atomické chování Google Sheets nebo neviděného
Apps Scriptu. Bez jejich zdrojů nepředstíráme hotové propojení.

## Implementovaný kontrakt

- `integration/paid-order-worker.mjs` se nikam automaticky neregistruje. Přijme
  trigger orderId, znovu čte důvěryhodný normalizovaný serverový záznam.
  Browser ani payload eventu neurčují stav platby, cenu nebo produkt.
- Normalizovaný order: `environment:test`, očekávaný `siteId`, `id`,
  `paymentStatus`, explicitní `cancelled/refunded/discounted:false`, měna CZK,
  `totalMinor`, položky `id/productId/variantId/quantity/unitAmountMinor`.
  Toto je interní kontrakt, NE tvrzení o Wix JSON schématu. Adaptér musí tato
  pole odvodit ze skutečného serverového Get Order a pravidel refundací/storen.
- NOT_PAID → žádná emise; neznámý stav refundace/storna, jiné produkty/ceny/měna,
  slevy či neznámý součet → ignorovat / ruční řešení. Smíšený košík není v B1
  schválen. Částky jsou celá čísla v haléřích, příjemce neřídí emisi.
- Klíč jednotky je JSON tuple `[siteId, orderId, lineItemId, unitNumber]`.
  Celý původní nákup má fingerprint z měny/součtu/všech položek v pevném pořadí.
  Změna ceny nebo množství po první emisi nepřidá poukaz a vyžaduje ruční řešení.
- `integration/test-apps-script-receiver.mjs` ověřuje podpis, testovací site,
  PAID, povolený digitální produkt/variantu/částku a rozsah kusu. Volá atomický
  issuer kontrakt `issueOnce`. Nevolá existující legacy create přes internet.
- `integration/testing/sqlite-ledger.mjs` v testu uloží kód a idempotentní
  vazbu v jediné lokální transakci. Jednotka má unikátní klíč i kód. Náhodné
  `TEST-...` kódy platí pouze v lokální fixture, nikoli v reálném systému.
- PDF vzniká z již uloženého záznamu. Chyba PDF ponechá ISSUED; retry po restartu
  čte stejný kód i platnost. PDF se ukládá atomicky jednou do testovacího BLOBu;
  souběžné vykreslení může proběhnout vícekrát, uložené PDF a kód zůstanou jediné.
- Žádný automatický e-mail, nativní Wix Gift Cards create ani online redemption.

## Podepsaná obálka

`protocol.mjs` používá náhodný testovací klíč v paměti testu (min. 32 bytes).
Žádný skutečný klíč není v kódu, logu nebo souboru repozitáře.

Obálka: `version:1`, unixový `timestamp` v milisekundách, `nonce`, `payload`
(base64url UTF-8 JSON), `mac` (malá hex SHA-256). Podepisuje se přesný ASCII
řetězec `version.timestamp.nonce.payload`. Příjemce kontroluje délky, MAC
konstantním porovnáním, časové okno ±5 minut, `environment:test`, kind a site.
Požadavek má kind ISSUE_UNIT_TEST, odpověď ISSUE_UNIT_TEST_RESULT a je rovněž
podepsaná, včetně unitKey a fingerprintu. Worker ověřuje jejich vazbu k žádosti.

V Apps Scriptu odpovídá HMAC výpočet `Utilities.computeHmacSha256Signature`
s UTF-8 bytes zprávy a bytes klíče dekódovanými ze serverové konfigurace.
Nepředpokládat dostupnost vlastních HTTP headers v GAS doPost(e); obálka patří
do těla požadavku. Tajemství nastavovat jen mimo repo. Opakování autentické
obálky v okně je bezpečně idempotentní podle trvalého klíče; nonce není
náhradou trvalé evidence. Expirace obálky nemění identitu voucheru při retry.

## Co musí zaručit skutečný Apps Script adaptér

1. Explicitně testovací script/site/sheet konfigurace a samostatný klíč;
   při chybějícím nebo neověřeném mapování skončit bez zápisu.
2. Znovu použít existující serverovou autorizační a emisní logiku a TUTÉŽ
   testovací tabulku voucherů. Nezavádět druhý seznam nezávisle platných kódů.
3. `LockService` musí pokrýt stejné cesty i souběžné žádosti a kontrolu
   idempotentního klíče v registru. Samotný zámek není transakce napříč listy.
4. Kód a jeho dohledatelná vazba na jednotku musí přežít výpadek v každém bodě.
   Neprovádět „ověř log → vzdálené create → zapiš log“. Při neurčitém výsledku
   nejdříve dohledat stejný klíč v emisním registru; pokud to backend neumí,
   zablokovat automatický retry a vyžadovat ruční reconciliation.
5. Zachovat oddělení ISSUED/PDF_READY/SENT, audit bez tajemství a osobních údajů,
   uloženou platnost podle schválených pravidel. Refundace po emisi se nesmí
   tvářit jako automatické zneplatnění kódu; zatím vyžaduje ruční postup.

Tyto vlastnosti musí po předložení backendu ověřit tester na oddělené tabulce.
Povolit je zapsáním několika názvů funkcí bez kontroly schématu nestačí.

## Soukromé originály a reprodukce

Podklady byly čtecím přístupem ověřeny v soukromém repozitáři
`zlatnicvi-konecni/Konecni_eschop_android`, větev `assets/voucher-original-pdfs`,
commit `fac12cdeebe13b6023135ccd49767605a740c52c`, složka
`codex-private-voucher-assets/Konecni_vouchery_originaly_3_PDF.zip`.
ZIP obsahuje voucher_3000.pdf / voucher_5000.pdf / voucher_10000.pdf; všechny
SHA-256 souhlasí s dřívějšími přílohami. Mapování a kalibrované pozice jsou
v `tools/pdf/original-templates.mjs`, bez PDF bytes a se schvalovacími flagy false.

```sh
# Zdrojový soukromý checkout musí být mimo veřejný voucher-konecni checkout.
node tools/pdf/import-private-zip.mjs /private/Konecni_vouchery_originaly_3_PDF.zip /private/originals
node --test tests/wix-b0.test.mjs tests/wix-integration.test.mjs
node tests/wix-b0.browser.cjs
VOUCHER_ORIGINALS_DIR=/private/originals npm test --prefix tools/pdf
```

Node 24 (node:sqlite), Playwright+Chromium pro UI; pro PDF npm ci v tools/pdf,
Poppler, Python s PyMuPDF a Pillow. Import ověřuje pevné názvy/hash, odmítne
jiné bytes i extrakci pod veřejný checkout; nepoužívá obecné extractAll.

Celý privátní test spojí ověřený testovací PAID order, podpis, fixture příjemce,
transakční fixture registr a skutečný renderer všech tří originálů. Z PDF
se při 300 dpi dekóduje přesně uložený kód, ověří vytištěný text/uložené datum,
rozměry a shoda původní grafiky mimo tři pole. Selhání PDF a replay nevytváří
nové záznamy. Fixture nastaví simulované schválení layoutu pouze pro test;
netvrdí fyzický tisk ani majitelské schválení. Normální adapter s defaultními
flagy false nadále odmítne generování evidovaného voucheru.

## Předání a rollback

Přejímka na skutečném testovacím webu: původní URL/galerie/checkout, převod,
NOT_PAID→0, PAID→1 kód+PDF na kus, opakovaný event/souběh/restart/timeout,
chybné ceny/měny/podpisy, privátní PDF, QR lookup a částečné/úplné čerpání,
regrese původního PIN/device/NIIMBOT. Žádná živá objednávka #10002.

Rollback tohoto kontraktu = revert commitu; žádné migrace ani vzdálené změny
neproběhly. Budoucí publish/switch až po nezávislé kontrole a výslovném souhlasu.
