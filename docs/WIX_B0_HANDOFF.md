# Wix podstránka poukazů — předání aktuálního návrhu PR #3

## Stav a ověřená reference

Jde o nativní Velo zdrojový návrh a lokální HTML preview. Není instalovaný ani
publikovaný ve Wixu; skutečná standardní pokladna se neotevírá. Backend
`prepareVoucherCheckout` zůstává fail-closed (`available:false`). Nový tok
nepoužívá nativní Wix Gift Cards emisi. Původní `index.html` je beze změny.

Veřejná stránka https://www.zlatnictvi-konecni.cz/darkovy-poukaz byla načtena
v Chromiu v čtecím režimu: pouze GET zdroje, všechny POST/purchase požadavky
zablokované. Provedena inventarizace celého formuláře, rozbaleného popisu,
režimu Pro mě a desktop/mobil snímků. Nepoužil se zákaznický účet ani Koupit.
Soukromé referenční snímky ani fotografie nejsou ve veřejném repozitáři.

Potvrzená původní fotografie:
`https://static.wixstatic.com/media/3b66ad_f4ac0f05d5594d73a593a1977148ed69~mv2.png`.
Preview i budoucí Wix stránka používají tento asset, nevytváří nový obrázek.
Ve Wix Editoru zachovat i původní crop a rozměry. Og:image celé stránky není
fotografie voucheru a nesmí se zaměnit za produktový obrázek.

Potvrzený nadpis používá Caudex, desktop 46 px / 57 px a barvu #3c0017. Preview
odkazuje na stejnou Caudex font cache ve Wixu. Velo stránka má převzít skutečné
site theme; lokální header/logo/login/footer jsou jen zástupné, nikoli pixelová
přejímka. V Editoru NEMĚNIT původní sdílené záhlaví, mobilní menu, foto, patičku,
správu souhlasů nebo cookie banner. Nezakládat nový viditelný odkaz v menu.

## Celý původní formulář a implementované chování

- Původní název, popis a omezení uplatnění pouze v kamenné prodejně v Olomouci.
  Rozbalení Zjistit více / Méně používá skutečný celý popis, nikoli odhad textu.
- Tři malé nominály 3 000 / 5 000 / 10 000 Kč a jednotková cena.
- Množství 1–10 s −/+, stejná validace v interním serverovém modelu.
- Pro někoho jiného / Pro mě. U Pro mě se skryjí a vymažou VŠECHNY údaje
  obdarovaného včetně zprávy, dne a času; to bylo ověřeno na původním widgetu.
- Jiný příjemce: E-mail příjemce (povinný, max 100), Jméno příjemce (volitelné,
  max 50), Datum doručení, Čas doručení s Nyní a čtvrthodinami, text o vypršení
  za 24 měsíců a Zpráva (max 500). Následuje původní CTA Koupit.
- Původní widget nemá další jméno odesílatele ani samostatný povinný checkbox
  v tomto formuláři. Dřívější mocková pole odstraněna. Právní souhlasy mají
  zůstat v původním Wix rámci/standardní pokladně, nikoli nově vymyšleném UI.
- Časy i výchozí den se vztahují k Europe/Prague; opraven přechod přes půlnoc
  mezi UTC a Prahou. Datum/čas jsou PREFERENCE předání, nikdy důkaz platby.
  Plánované doručování/e-mail zatím NEFUNGUJE a není zapnuté. Před přepnutím
  musí majitel schválit, jak obsluha požadovaný termín při ručním odeslání splní.
- Změna údajů / invalid vymaže starý status. V nativním controlleru se při
  submit uzamknou vstupy i tlačítka, aby výsledek nepopisoval mezitím změněná data.

## Wix Editor — prvky pro izolovaný návrh

| ID | Nativní prvek / nastavení |
| --- | --- |
| voucherAmount | RadioButtonGroup: 3000 / 5000 / 10000; default 3000 |
| voucherPrice | Text s aktuální jednotkovou cenou |
| voucherQuantity | Number input: celé číslo 1–10, default 1 |
| quantityMinus / quantityPlus | Buttons − / +, přístupné popisky Snížit/Zvýšit množství |
| recipientType | RadioButtonGroup: other / self; default other |
| recipientFields | Collapsible container VŠECH polí příjemce a zprávy/doručení |
| recipientEmail | Email input, povinný pro other, max 100 |
| recipientName | Text input, nepovinný, max 50 |
| deliveryDate | DatePicker, kalendářní den; výchozí dnešek Europe/Prague |
| deliveryTime | Dropdown, value now nebo HH:mm; options vytváří controller |
| giftMessage | TextBox, max 500, volitelný |
| descriptionSummary / descriptionFull | Textové prvky s původním zkráceným/celým popisem |
| descriptionToggle | Button Zjistit více / Méně |
| continueCheckout | Button s původním textem Koupit |
| voucherStatus | Text s přístupným live oznámením nastaveným v Editoru |

Vložit page code `wix/pages/darkovy-poukaz.js`; veřejný modul
`wix/public/voucher-model.mjs` v Editoru uložit jako `public/voucher-model.js`.
`wix/backend/voucherCheckout.web.js` zůstává nepropojený. `voucher-domain.mjs`
je interní normalizovaný návrh, nikoli skutečné Wix API JSON schéma.

Interní checkoutIntent vybírá digitální produkt/variantu z povolené serverové
mapy, nikoli z klientských ID/ceny. Nese nominál za kus, množství a součet.
Pro mě vrací recipientSource=CHECKOUT_CUSTOMER, recipient=null. Budoucí backend
musí použít zákazníka z autorizovaného checkoutu, nikoli client buyerEmail.
Údaje příjemce/zprávy nesmějí být v URL nebo diagnostických logách.

## Co vyžaduje skutečný Wix testovací web

1. Zachovat finální zákaznickou URL `/darkovy-poukaz`, která již existuje.
   Ověřit, zda lze bezpečně nahradit nativní widget, nebo je třeba nejdříve
   izolovaná dočasná testovací route. Původní stránku nesmazat, uložit rollback.
2. Vytvořit běžný digitální Stores produkt/varianty bez nativní Gift Cards emise.
   Kategorie galerie šperků musí voucher vyloučit, ale produkt zůstat koupitelný.
   Samotný hidden přepínač není důkaz funkčnosti.
3. Přidat serverově vybranou položku do AKTUÁLNÍHO košíku s visitor/member
   session a otevřít standardní Wix checkout. Nevěřit browserem dodanému cart ID,
   nepoužívat externí checkout URL. Zachovat bankovní převod a digitální dopravu.
4. Ověřit aktuální Cart API / případnou Cart V2 migraci. Pro read order je nutná
   Wix serverová identita a Read Orders; custom line items by vyžadovaly další
   admin oprávnění, proto preferujeme Stores katalog. Secrets pouze na serveru.
5. Pro budoucí emisi použít ověřený payment event a znovu Get Order. Backend
   events nefungují ve Wix Preview; ani testovací publikace není tímto PR povolená.
6. Ověřit nativní desktop/mobil vzhled, celou cestu do checkoutu, galerie,
   digitální daně/slevy/smíšené košíky, termíny ručního předání a privacy flow.

## Evidence, PDF, přejímka

Spustitelná další etapa a přesný testovací kontrakt jsou v
`docs/WIX_B1_TEST_STAGE.md`; obsahuje autentizaci, replays, trvalé klíče,
restart/timeout a hranici mezi SQLite fixture a skutečným Apps Scriptem/Sheets.
Všechny originály se nyní ověřují ze soukromého repozitáře, ne z veřejného PR;
metadata, loader a testy jsou v `tools/pdf`. Layout approvals jsou stále false
pro běžný renderer; fyzický tisk a skutečné serverové mapování nejsou schválené.

Původní Apps Script/schéma/oddělená testovací tabulka a Wix Studio přístup stále
chybí. Proto nebyl skutečně proveden PAID→Google Sheets ani QR čerpání přes
existující backend. Offline testy tuto přejímku nenahrazují. Online uplatnění
v checkoutu je další samostatný projekt. Objednávka #10002 zůstala beze změny.

Rollback změn = revert příslušného commitu, bez migrace nebo vzdálené konfigurace.
Přepnutí horního odkazu/routy až po nezávislé kontrole a výslovném schválení.
