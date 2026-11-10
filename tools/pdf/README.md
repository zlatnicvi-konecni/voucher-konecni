# Soukromé PDF předlohy — testovací adaptér

Pouze Node nástroj / návrh rendereru; není nasazený ve Wixu ani Apps Scriptu.
Žádný veřejný endpoint, aktivace, generátor voucherových kódů, odesílání e-mailů
nebo zapisování do evidence. Kód pro skutečný testovací PDF přichází pouze z
již vydaného serverového záznamu. Rozhraní je nový interní normalizovaný kontrakt,
nikoli tvrzení o neviděném schématu stávajícího Apps Scriptu.

## Převzetí originálů

| Předloha | Stav v tomto prostředí |
| --- | --- |
| `3000_darkovy poukaz_edit1.pdf` | Převzata soukromou přílohou, ověřeny 2 strany 170 × 120 mm |
| `5000_darkovy poukaz_edit1.pdf` | Dosud chybí |
| `10000_darkovy poukaz_edit.pdf` | Dosud chybí |

U 3k byl ověřen MediaBox/CropBox/TrimBox bez rotace. Vstupní SHA-256:
`6899fdebd0f0f027509ffe00e7af37ec91fcfd0dbcd71674ed8cd081663f177d`.
Originály, náhledy, soukromé manifesty ani skutečné kódy se NEukládají do tohoto
veřejného repozitáře. `.gitignore` ignoruje PDF, private/, work/ a node_modules.

## Jak funguje renderer

`renderTestVoucherPdf({record, templateBytes, approvedTemplate})`:
- vyžaduje `environment: test`, potvrzenou platbu a stav ISSUED/PDF_READY/SENT;
  `voucherId`, `amount` 3000/5000/10000, `currency: CZK`, přesný uložený `code`
  a kalendářní `validUntil: YYYY-MM-DD`; nic z toho nebere z browseru;
- porovná SHA-256 předlohy se serverovým manifestem pro stejnou částku;
- vyžaduje schválení vizuálního A tiskového rozložení právě této předlohy;
  neexistují defaultní souřadnice. Pro každou hodnotu je samostatný manifest;
- načte původní PDF, nenahradí ho obrázky a nepřepočítává měřítko ani obsah;
- zkontroluje přesně 2 neotočené stránky 170 × 120 mm (tolerance 0,2 pt);
- pouze na straně 2 přidá lokálně vykreslený vektorový QR, stejný čitelný kód
  a uložené datum. QR obsahuje jen kód, žádné URL/osobní údaje;
- QR má čtyřmodulovou bílou ochrannou zónu, minimálně 18 mm a 0,3 mm/modul;
- překrytí polí, pozice mimo oblast Kód/Platnost, nečitelně malý QR nebo text,
  který by se nevešel, končí chybou. Text se nezkracuje a kód se nemění;
- vrátí bytes; uložení do soukromého úložiště je úkol autentizovaného backendu.

Schválení manifestu i záznam jsou důvěryhodné serverové vstupy, nikoli
bezpečnostní kontrola přístupu samy o sobě. Pouhé nastavení booleanů klientem
nesmí zpřístupnit renderer. V integrační vrstvě bude nutné ověřit staff přístup,
testovací prostředí, vazbu na registr a předkládat pouze potřebné údaje.

Regenerace vždy čte tutéž vydanou položku. Renderer nevolá create ani lookup;
selhání PDF nezaloží další voucher. Idempotence serverové emise a atomické
uložení vazby kódu je nadále neimplementovaná část testovacího Apps Scriptu.

## Kalibrace před schválením

Oddělený `renderCalibrationPdf` přijímá jen předlohu a navržené rozložení.
Vždy vloží `TEST-NEPLATNY-<částka>` a pevné UKÁZKOVÉ datum `10.11.2028`;
žádný platný kód ani vypočtená skutečná platnost tím nevzniká. Nevydává poukaz,
nepřistupuje k evidenci. Umožňuje kontrolní tisk před odsouhlasením pozic;
`renderTestVoucherPdf` se stejným neschváleným manifestem zůstává zablokovaný.

Instalace (z kořene repozitáře):

```sh
npm ci --ignore-scripts --prefix tools/pdf
node tools/pdf/calibrate.mjs /soukrome/original.pdf /soukrome/layout.json /soukrome/TEST_neplatny.pdf
```

CLI nikdy nepřepíše existující soubor a ukládá výstup s právy 0600. Nevkládat
platný kód do CLI argumentů. Souřadnice manifestu jsou milimetry od levého
DOLNÍHO rohu, strana 2, fonty v bodech. SHA a částka náleží stejnému originálu.

Návrh souřadnic ZMĚŘENÝ pro přijatou 3k předlohu (není schválen tiskem):

| Prvek | x / y / šířka / výška mm | Font |
| --- | --- | --- |
| QR včetně bílé zóny | 21 / 21 / 18 / 18 | — |
| Text kódu | 21 / 15 / 35 / 4,2 | 9 pt |
| Platnost | 76 / 16 / 28 / 5 | 9 pt |

Soukromý JSON má `amount`, `sha256`, `layout` s `page:2`,
`units:"mm-bottom-left"`, `visualApproved:false`, `printApproved:false`
a poli `qr`, `code`, `expiry` dle tabulky (`x,y,width,height,fontSizePt`).
Tyto pozice NEpřenášet automaticky na 5k/10k bez převzetí a kontroly originálů.

## Reprodukovatelné testy

```sh
npm test --prefix tools/pdf
# Volitelný test skutečného soukromého originálu a měřeného layoutu:
ORIGINAL_PDF=/soukrome/original.pdf PDF_LAYOUT=/soukrome/layout.json npm test --prefix tools/pdf
```

Běžný test generuje pouze zjevně syntetické testovací stránky bez hodnoty;
NEJSOU náhradou originálních grafik. Testuje všechny částky, opakovanou
regeneraci, geometrii, text a QR, odmítání chybného stavu/šablony/layoutu.
Rasterizace: Poppler `pdftoppm`/`pdftotext`. Volitelný test originálu navíc
vyžaduje Python s PyMuPDF a Pillow; porovnává skutečný vstup a výstup na 300 dpi.
Nikde se nevolá veřejná QR služba ani backend evidence.

Na skutečné 3k předloze PROŠLO: dvě strany, rozměry, první strana pixelově
shodná, strana 2 mimo tři pole pixelově shodná, text + datum a dekódování QR
odpovídají kalibračnímu vzorku. Fyzický tisk/sken z papíru, schválení pozic,
5k/10k originály a kód+platnost ze skutečné testovací evidence ZATÍM NEOVĚŘENY.

Rollback: revert commitu rendereru; neexistuje migrace, změna serveru ani dat.
