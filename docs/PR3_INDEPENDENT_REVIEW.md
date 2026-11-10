# PR #3 — nezávislá kontrola testovacího agenta

Kontrolovaný výchozí commit: `dec728a`.
Opravný commit a závěrečný recheck: `46a93b7`.
Kontrolu provedl samostatný testovací agent, který tuto implementaci nevytvářel.
Neměnil implementační soubory, nepoužil skutečnou objednávku ani evidenci.

## Výsledek

**OFFLINE etapa po opravě nalezeného P2 prošla nezávislou kontrolou.** Nebyl
nalezen další blokující nedostatek v prověřeném lokálním kontraktu. PR má nadále
zůstat Draft: výsledek není souhlasem s merge, publikací ani přepnutím Wixu.

Skutečný Wix checkout, serverový Get Order, nasazený Apps Script/Google Sheets,
fyzický tisk a majitelská přejímka vzhledu zůstávají neprovedené. Výsledky
SQLite fixture nelze vydávat za důkaz atomické emise v Google Sheets.

## Nález P2 — opraven a znovu ověřen

`tools/pdf/import-private-zip.mjs` na `dec728a` používal Python `assert` pro
bezpečnostní kontroly SHA, ZIP položek, soukromého cíle a symlinků. Při
`PYTHONOPTIMIZE=1` se tyto kontroly vypnuly.

Reprodukce bez použití skutečných originálů:

1. Pod ignorovaným `work/` vytvořit syntetický ZIP se třemi očekávanými názvy
   voucher_3000.pdf / voucher_5000.pdf / voucher_10000.pdf a neplatnými bytes.
2. Spustit `PYTHONOPTIMIZE=1 node tools/pdf/import-private-zip.mjs work/review-private-import.zip work/review-private-import-destination`.
3. Očekáváno: odmítnutí, bez vytvoření cíle. Na výchozím commitu: exit 0,
   zpráva Verified a tři syntetické soubory uvnitř veřejného checkoutu.

Žádný skutečný originál při reprodukci nevstoupil do veřejného checkoutu.
Nález byl ihned předán vývojovému agentovi. Oprava `46a93b7` používá explicitní
`if/raise`; přesná reprodukce nyní končí exit 1 a cíl nevznikne. Nezávisle
prošly i nové optimalizační regrese: chybný SHA mimo checkout, správné originály
na zakázaném veřejném cíli, povolený soukromý import, opakovaný shodný import
a symlink s nezměněným sentinel souborem.

Prověřena také ochrana PDF testů před falešným PASS: Python verifier nyní
vynucuje `PYTHONOPTIMIZE=0` a odmítne běh bez `__debug__`. Celá sada byla
znovu spuštěna s rodičovským `PYTHONOPTIMIZE=1`.

## Skutečně spuštěné testy

| Příkaz / kontrola | Výsledek |
| --- | --- |
| `node --test tests/wix-b0.test.mjs tests/wix-integration.test.mjs` | 11/11 prošlo na dec728a; opravný commit tyto implementace nemění |
| `node tests/wix-b0.browser.cjs` | Prošlo: Chromium 390/768/1440 px, lokální routing, žádné externí API |
| `VOUCHER_ORIGINALS_DIR=/workspace/work/private-voucher-assets-extracted npm test --prefix tools/pdf` | Na dec728a 6 pass / 1 dokumentovaný skip |
| `PYTHONOPTIMIZE=1 VOUCHER_ORIGINALS_DIR=/workspace/work/private-voucher-assets-extracted npm test --prefix tools/pdf` | Na 46a93b7 8 pass / 1 dokumentovaný skip |
| Původní reprodukce P2 pod optimalizací na 46a93b7 | Správně odmítnuta, cíl nevznikne |
| `git diff --exit-code origin/feature/online-vouchery-wix-test -- index.html` | Původní aplikace beze změny |
| Kontrola verzovaných PDF/ZIP/fotografií/SQLite | Žádný takový soubor verzovaný není |
| `git diff --check` | Bez chyb |

Skip je starší volitelný single-original test, jehož samostatné env proměnné
nebyly nastaveny. Nový all-private-originals test byl spuštěný a ověřil všechny
3 skutečné originály, nikoli jejich syntetické náhrady.

## Co bylo ověřeno v kontraktu

- NOT_PAID objednávka nevydá kód ani při podvrženém PAID v trigger payloadu.
  Worker vždy znovu čte serverový normalizovaný order a ověřuje site/scope.
- HMAC požadavku i odpovědi, časové okno a odmítnutí změněných dat, špatného
  klíče/site/částky/měny/kusu. Klient neurčuje cenu ani příjemce režimu self.
- Replay, 20 souběžných volání a 6 nezávislých procesů zachovají jediný trvalý
  kód na jednotku; po restartu/timeoutu se vrací stejný kód. Změna nákupu po
  první emisi vyžaduje ruční řešení. Množství 3 znamená 3 jednotky, ne jeden kód.
- Chyba PDF zachová ISSUED a již uložený kód; retry uloží PDF pro stejnou
  položku. Jeden lokální registr i výstup zůstávají zachované po opakování.
- U všech skutečných PDF: dvě stránky 170 × 120 mm, první strana pixelově
  shodná a druhá mimo tři doplněná pole shodná při 300 dpi. QR, čitelný text
  a datum odpovídají lokálnímu vydanému TEST záznamu. Fixture lookup a částečné
  čerpání zachovávají identitu kódu. Defaultní schválení layoutů zůstávají false.
- Formulář: všechny nominály, množství, self/other, mazání skrytých údajů,
  volitelné jméno, zpráva, doručení, validace a odstranění starého statusu.
  Prohlédnut i aktuální lokální desktop/mobil náhled se skutečnou fotografií.

## Hranice této kontroly

Lokální náhled má správný zdroj fotografie a ovládací prvky, ale header/footer
jsou zástupné a font cache je v offline browser testu zablokovaná. Nelze tím
potvrdit pixelovou shodu ve Wix Studio nebo nativní formát DatePickeru. Tyto
rozdíly jsou dokumentovanou hranicí, nikoli prohlášením hotového zákaznického UI.

Skutečná emise, PIN/device autorizace, NIIMBOT, Google Sheets transakční
chování, refundace po emisi a reálné uplatnění nebyly připojené ani testované.
Původní `index.html` je byte-identický; jeho fyzický provoz se tím necertifikuje.

Pokračovat lze přípravou izolovaného skutečného testovacího prostředí podle
`WIX_B1_TEST_STAGE.md`. Přepnutí původního odkazu a publikace vyžadují další
reálnou přejímku a výslovný souhlas majitele. Nebyl proveden deploy, merge,
zápis do reálné evidence ani odeslání zákazníkovi.
