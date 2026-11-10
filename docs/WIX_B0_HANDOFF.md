# Issue #2 — B0: vlastní stránka ve Wixu (nepublikovaný návrh)

## Co je připravené

Samostatná nativní Wix Studio stránka: kód `wix/pages/darkovy-poukaz.js`,
společná validace `wix/public/voucher-model.mjs` a bezpečně nepropojený backend
`wix/backend/voucherCheckout.web.js`. Backend vždy vrací nedostupnou pokladnu,
nevytváří košík/objednávku/poukaz ani neposílá e-mail. Nepoužívá nativní Gift
Cards API. Nikde není event handler aktivující emisi.

`wix/preview/` je pouze lokální responzivní náhled rozvržení, NE stránka pro
hostování na GitHub Pages. Nezavádět HTML iframe do Wixu. Skutečná stránka má
použít native Wix prvky a sdílený site header/footer, design tokens a existující
cookie/privacy komponenty. Náhled obsahuje zástupný textový brand a ilustraci;
netvrdíme pixelovou shodu se schváleným e-shopem. Nepřidávat grafiky do tohoto
veřejného repozitáře bez souhlasu.

## Zjištění z veřejného webu (10. 11. 2026)

Čtecí kontrola https://www.zlatnictvi-konecni.cz/ a odkazu Dárkový poukaz:
- `/darkovy-poukaz` UŽ EXISTUJE. Nepřepsat ani nepřesměrovat. Staging návrh
  pracovně `/darkovy-poukaz-test`, URL ověřit v Editoru před založením.
- Navigace Home / Obchod / O nás / Kontakt; společná patička včetně právních
  odkazů. Existující horní odkaz musí do schválení zůstat beze změny.
- Veřejný text cílové stránky obsahuje 3/5/10 tisíc, množství a tlačítko Koupit;
  z čtecího textu nelze určit skutečný typ produktu ani celý formulář. Je třeba
  v Editoru potvrdit aplikaci, checkout a aktuální pole příjemce.
- Ve veřejném markup je brand barva #C59854; ostatní barvy/fonty návrhu jsou
  pracovní, nikoli vyexportované tokeny. Ve Wixu převzít skutečný theme.

Nebyl změněn živý web, košík, platební stav ani objednávka #10002.

## Postup pro izolovaný Wix návrh — zatím NEPROVEDENO

1. Získat přístup k oddělenému testovacímu Wix webu / nepublikovanému návrhu.
   Zachovat globální header/logo/menu/footer, mobilní menu a správu souhlasů.
   Vložit pouze nový obsah pod header. Header neklonovat do stránky.
2. Přidat nativní prvky s IDs:

| ID | Wix prvek / konfigurace |
| --- | --- |
| voucherAmount | RadioButtonGroup, hodnoty řetězce 3000 / 5000 / 10000, default 3000 |
| recipientName | Text input, povinné, max 100, viditelný label |
| recipientEmail | Email input, povinné, max 254, viditelný label |
| senderName | Text input, povinné, max 100 |
| giftMessage | Text box, volitelné, max 500 |
| privacyAcknowledged | Checkbox a stávající právní odkaz webu; text schválit |
| continueCheckout | Button „Pokračovat do pokladny“ |
| voucherStatus | Text s přístupným live status oznámením nastaveným v Editoru |

   Nad formulář umístit nadpis a produktovou ilustraci, na desktopu 2 sloupce,
   pod 700 px jeden sloupec, pořadí obrázek → nadpis → pole → CTA. Obsloužit
   klávesnici, focus, popisky a chyby; ověřit i Wix accessibility checker.
3. Zkopírovat `voucher-model.mjs` jako Wix `public/voucher-model.js` (ES modul),
   `.web.js` do backendu a page code do nové stránky. `.mjs` přípona zde slouží
   lokálním Node testům. `voucher-domain.mjs` je testovatelný NÁVRH interního
   kontraktu, nikoli Wix order JSON či instalovaný integrační backend.
4. Sestavit běžný digitální Wix Stores produkt / 3 varianty bez jakéhokoli
   nativního Gift Cards napojení. Serverová allowlist mapa nominál → productId
   + variantId + cena + CZK. Nepřebírat ID, cenu či příznak voucheru od klienta.
   Košík musí zachovat visitor/member session; neprovádět přes elevaci přístupu
   k libovolnému košíku podle browserem dodaného ID.
5. Produkt zařadit do vyhrazené kategorie voucherů a galerie šperků konfigurovat
   na explicitní kategorie bez voucheru. Ověřit všechny galerie, vyhledávání a
   související produkty. Přepínač hidden může blokovat prodej; samotný návrh
   nastavení není důkaz, že produkt zůstává zakoupitelný.
6. Až v B1 nahradit nepropojený backend skutečným cart/checkout adaptérem.
   Přidat serverem vybranou variantu k AKTUÁLNÍMU košíku a použít standardní
   Wix checkout/navigation API. Žádná ručně sestavená externí checkout URL.
   Uchovat příjemce/věnování serverově s náhodným draft ID, bezpečně navázaným
   na session, položku a objednávku; osobní údaje nedávat do URL/console/analytics.
   Mapování konkrétních Wix polí ověřit, nevkládat vymyšlený payload z B0.
7. Bankovní převod, dopravu digitální položky, případné slevy/daně, smíšený košík,
   idempotenci dvojkliku a obnovu při neurčitém výsledku checkoutu ověřit na
   skutečném testovacím webu. Pro smíšené košíky/slevy B0 inspektor bezpečně
   vyžaduje ruční řešení; obchodní pravidla ještě nejsou schválena.

## Konkrétní API pro další etapu

- Current Cart s visitor/member identitou: [Add To Current Cart](https://dev.wix.com/docs/velo/apis/wix-ecom-backend/current-cart/add-to-current-cart),
  [Create Checkout From Current Cart](https://dev.wix.com/docs/velo/apis/wix-ecom-backend/current-cart/create-checkout-from-current-cart).
  Ověřit instalovanou verzi a Cart V2 migraci: REST v1 add-to-cart dokumentace
  avizuje deprecaci 1. 2. 2027 ve prospěch Add Line Items To Current Cart.
- [Wix eCommerce frontend](https://dev.wix.com/docs/velo/apis/wix-ecom-frontend/introduction):
  refresh cart + navigateToCheckout; standardní checkout zůstává ve Wix flow.
  Ověřit výslednou adresu/doménu na konkrétním webu, neprohlašovat ji za hotovou.
- [Payment status event](https://dev.wix.com/docs/velo/events-service-plugins/e-commerce/events/on-order-payment-status-updated),
  `orders.getOrder` pro čerstvé serverové čtení s oprávněním Read Orders.
  Eventy neběží ve Wix Preview; publikace odděleného testovacího webu vyžaduje
  další schválení, v tomto PR se nic nepublikuje.
- Backendový webMethod pouze sestaví checkout. Vydání nesmí být veřejný
  webMethod. Wix Secrets a Apps Script ScriptProperties pouze serverově;
  admin scope pro custom line items zatím nepotřebujeme (preferován Stores
  katalog). Konkrétní oprávnění ověřit podle zvoleného API v B1.

## Platba, idempotence, PDF — navržený kontrakt, ne integrace

Wix ověřený event → fresh getOrder → kontrola PAID, měny CZK, serverového
produktu/varianty, jednotkové ceny, kusů, součtů, storna/refundace → interní
normalizovaný order → plán jednotek. `inspectPaidOrder` nikdy nic nevydává.
Klíč jednotky je JSON tuple `[orderId,lineItemId,unitNumber]`; event ID je
pouze audit/replay identifikátor. Stabilní klíče samy o sobě NEJSOU transakce.

B1 Apps Script adaptér musí ověřit testovací prostředí, autentizaci, časové
okno podpisu/nonce a vazbu na povolený Wix site. Přesný podpisový kontrakt a
přenos bez spoléhání na nepodporované GAS request headers definovat až podle
zdrojů backendu (případně podepsaná obálka těla). LockService i dohledatelný
idempotentní klíč musí být ve stejném serverovém emisním registru. Pád mezi
zápisy nesmí vést k nové emisi; neurčitý výsledek vyžaduje načtení/reconciliation.

PDF až z téhož uloženého kódu, soukromé úložiště, bez automatického e-mailu.
Požadované vstupy: 3k/5k/10k dvoustránkové grafiky 170×120 mm; zde nejsou
k dispozici. Zadní strana dole vlevo pole Kód: QR + čitelný stejný kód;
uprostřed dole platnost. Selhání PDF ponechá ISSUED; retry generuje PDF stejného
voucheru. Platnost 24 měsíců je dosud pravidlo k potvrzení, ne serverový fakt.
Online uplatnění přes Wix checkout není v této etapě implementované.

## Test report / otevřená akceptace

- `node --test tests/wix-b0.test.mjs`: validace hodnot/osobních údajů,
  ignorování podvržené ceny/product ID, NOT_PAID/částka/měna/refundace/storno,
  stabilní klíče a rozlišení kusů; vše jen in-memory, žádná skutečná emise.
- `node tests/wix-b0.browser.cjs`: offline Chromium 390/768/1440 px, bez
  horizontálního přetečení, náhled horní CTA → formulář, všechny hodnoty,
  validace a mazání statusu. Žádná navigace do externí domény ani API požadavek.
- Původní `index.html` je beze změny proti výchozí testovací větvi. Původní
  create/lookup/redeem/device/QR/NIIMBOT se v B0 nezapojují. Jejich živá regrese
  ani opravy z dosud samostatného PR #1 nejsou součástí tohoto PR.
- NEOTESTOVÁNO: instalace v Editoru, pixelová shoda, skutečné CTA → standardní
  checkout, doména pokladny, koupitelnost mimo galerie, skutečný PAID → 1 zápis
  + 1 PDF, replay/concurrency, fyzický QR/čerpání a tisk. Nelze splnit bez Wix
  přístupu, testovacího Apps Script kódu/schématu/tabulky a PDF předloh.

Přejímka B1 musí zahrnout NOT_PAID → nic, PAID → 1 voucher + 1 PDF, replay/
dvojklik/souběh/timeout → tentýž kód; chybný produkt, cena, měna a refundace →
blokace/ruční řešení, QR lookup a částečné redeem v testovací evidenci. Nikdy
neoznačovat živou objednávku za zaplacenou kvůli testu.

Nezávislá kontrola: tento dokument je předání existujícímu testerovi, nikoli
nezávislý review. Nový agent nebyl založen. Po review a všech přejímkách teprve
žádat majitele o souhlas s přepnutím; současný horní odkaz zůstává nezměněný.
Rollback B0: revert PR commitu, žádná datová migrace. Budoucí přepnutí musí mít
uložený původní cíl tlačítka; historické Wix karty a původní stránku nemažeme.


## Závazné upřesnění originálů a vzhledu (Issue #2, doplnění 10. 11. 2026)

Předchozí barevná ilustrace náhledu nebyla schválená a byla odstraněna. Náhled
nyní odkazuje na PŘESNÝ původní asset fotografie z veřejné Wix stránky:
`https://static.wixstatic.com/media/3b66ad_f4ac0f05d5594d73a593a1977148ed69~mv2.png`.
Byl vizuálně ověřen na čtecím snímku stránky (bílý voucher, růžové květiny,
zlaté hrany). Soubor fotografie nebyl přidán do veřejného repozitáře. Obrázek
z obecné og:image metadata stránky byl prověřen a NENÍ fotografií voucheru;
nesmí se použít jako náhrada. Native Wix stránka převezme tento existující
Media Manager asset a původní crop/rozměry; nemá vytvářet nový obrázek.

V náhledu bílé pozadí, skutečný název, malé nominálové volby a omezení uplatnění
pouze v kamenné prodejně. To pořád není potvrzená vizuální kopie. Původní header,
logo, login/košík, footer, přesné theme fonty/rozměry a všechny dynamické části
formuláře musí zůstat ve Wix rámu. Před přepnutím musí proběhnout srovnání
s celým aktuálním formulářem a screenshoty desktop/mobil.

Čtecí browser kontrola nepovolovala žádný POST ani nákupní akci. V tomto
omezeném režimu byly vidět nominály, Množství (1–10) a Koupit, ale nebyla
zpřístupněna celá dynamická část. Podle reference majitele je nutné doplnit
přepínač Pro někoho jiného / Pro mě, původní popis se Zjistit více a všechna
navazující pole. B0 model nyní pracuje s jedním kusem a pevným příjemcem;
nejde o hotovou náhradu tohoto formuláře. Neodvozovat chybějící pole z domněnek.

Finální zákaznická URL má zůstat `/darkovy-poukaz`; případná jiná cesta slouží
jen izolovanému nepřipojenému testu. Předpoklad změnitelnosti nativní stránky
musí potvrdit Wix Studio. Žádný nový odkaz/menu ani přepnutí na ostrém webu.

PDF pipeline: viz `tools/pdf/README.md`. Originál 3k již převzat a na něm
ověřen neplatný kalibrační výstup; 5k/10k stále nejsou k dispozici. Nikde
nebyl použit nebo vystaven reálný voucherový kód. Skutečná platnost se bude
číst z evidence, ukázkové datum není nové obchodní pravidlo. PDF/fotografie
ani soukromé kontrolní screenshoty se do veřejného PR nevkládají.
