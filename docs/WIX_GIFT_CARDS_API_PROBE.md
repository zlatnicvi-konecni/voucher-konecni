# Koneční Vouchery — test Wix Gift Cards API (varianta A)
**Stav:** plán testu; žádný živý Wix API test zatím neproveden. Vytvořeno pouze ve vývojovém repozitáři.
**Rozsah:** zachovat současné tlačítko „Koupit voucher“, design a původní Wix Gift Cards stránku. Jde o rozhodnutí A vs. B, nikoli povolení vydávat poukazy na ostrém Wixu.

## Zjištění z oficiální dokumentace (10. 11. 2026)
- `Gift Card Created` event: zpráva je podepsaný JWT a obsahuje `createdEvent.entityId`, nikoli nezakrytý kód. Ověřovat podpis, idempotenci podle event ID. https://dev.wix.com/docs/api-reference/business-solutions/gift-cards/gift-cards/gift-card-created
- `GET /gift-cards/v1/gift-cards/{giftCardId}` vrací **maskovaný** kód; rovněž Query/Search vrací obfuskovaný kód (jen poslední čtyři znaky). https://dev.wix.com/docs/api-reference/business-solutions/gift-cards/gift-cards/introduction
- `POST /gift-cards/v1/gift-cards` umí volitelný vlastní kód a `idempotencyKey`. API dokumentace tvrdí, že v odpovědi na **Create Gift Card** lze získat plný kód, ale její ukázka odpovědi je maskovaná. Považovat za **neověřené**, dokud test neprokáže chování. https://dev.wix.com/docs/api-reference/business-solutions/gift-cards/gift-cards/create-gift-card
- `Query Gift Cards` podporuje hledání podle **známého úplného** kódu, i když odpověď kód maskuje. To znamená, že při vlastním generování lze kód ověřovat a udržovat identitu v obou systémech.
- Není doloženo, že `Create Gift Card` API zachytí kód, který Wix při **standardním nákupu přes stávající prodejní stránku sám** generuje. Samostatné API vytváření by mohlo způsobit **dvojí emisi**, takže tím standardní nákup bez ověření nenahrazovat.

## Fáze 0: pouze čtení (lze dělat ještě před vytvořením testovacího poukazu)
1. Identifikuj Wix Gift Cards API dostupné pro tento web; potřebné scopes a způsob autentizace. Přístupový token a site ID neukládat do GitHubu, frontend JS ani logů. Ověř, zda má vývojové prostředí oprávnění ke Wixu; nemá-li, zaznamenej blocker.
2. Vyjasni typickou událost eCommerce order `PAID`, Gift Card Created a jejich vazbu přes `orderInfo` / giftCard ID. Připrav read-only diagnostický modul na Wix backendu pro ID, maskovaný kód, částku, měnu, expiraci a zůstatek; žádné e-maily ani celé kódy nevypisovat do logů.
3. Zkontroluj, jak lze pro Wix dárkový poukaz už známý úplný kód pomocí API ověřit a zda se vracejí stabilní ID a stav.
4. **Zatím neoznačovat žádnou objednávku jako PAID**, zejména existující #10002. Žádné API create/disable/redeem/send-email v ostrém Wixu.

## Fáze 1: bezpečný izolovaný test kódu
POUZE na samostatném Wix testovacím webu nebo po výslovném souhlasu majitele s vydáním jednoho testovacího Wix voucheru:
A. Vygeneruj **náš testovací** kód o platné délce (bez ukládání do logů), API `Create Gift Card` s unikátním `idempotencyKey`, nominální hodnotou a bez doručovacího e-mailu. Porovnej odpověď: celý kód vs. maskovaný kód. Částku a zůstatek porovnej s `Get Gift Card`. Opakuj vytvoření se stejným idempotencyKey; nezvyšuj počet poukazů.
B. Vyzkoušej pouze v odděleném Wix testovacím webu scénář **původního tlačítka Gift Cards** → testovací platba → Wix samo generuje voucher → event Created → Get/Query. Zjisti, zda kdekoliv v bezpečném serverovém kontextu existuje plný kód bez čtení příjemcova mailu.
C. Pokud kód z původní Gift Cards checkout není dostupný, nelze bezpečně vygenerovat QR s plným kódem pouze z `entityId` či posledních čtyř znaků.

## Rozhodnutí A/B podle testu
- **A1:** Checkout původních Gift Cards bezpečně poskytuje úplný kód jen důvěryhodnému backendu, lze navázat na `orderId`, amount, expiration a všechny změny stavu. Navrhni jeden záznam v testovací Google Sheets, jeden QR a PDF. Nesynchronizuj pouze počáteční částku: čerpání z obou platforem musí být atomické a udržovat stejný zůstatek; v opačném případě zůstane uplatnění přes jednu platformu vypnuté.
- **A2:** Pouze vlastní Create Gift Card API poskytne úplný kód, ne původní checkout: tato možnost *sama o sobě* neřeší stávající prodej bez druhé emise. Navrhni alternativu zachovávající tlačítko/vzhled s vlastní logikou na Wix backendu; porovnej s B.
- **B:** Standardní checkout poukaz generuje nezískatelný kód nebo jinak nejde bezpečně udržet společný zůstatek → ponechat vizuální stránku/tlačítko, nahradit pouze obchodní logiku Wix formuláře a po potvrzené platbě volat idempotentní Apps Script. Výchozí Gift Cards checkout pro tyto objednávky nesmí vytvořit paralelní poukaz.

## Přijetí testu
- Zdokumentované skutečné JSON **schéma** bez tokenů a bez odkrytých platných kódů.
- Jasné tabulkové výsledky: `Create response full code?`; `Get/Query full code?`; `Created event full code?`; `Paid checkout full code accessible?`; `online+kamenná prodejna synchronizují zůstatek?` — u každé **ANO/NE/NEOTESTOVÁNO** s důkazem.
- Pokud API klíče nebo testovací Wix site chybí: explicitně **NEOTESTOVÁNO**, žádné tvrzení o úspěšném propojení.
- Žádné zápisy do `Dilnakk/voucher` ani do produkční Google Sheets. Neoznačovat #10002 jako zaplaceno. Neslučovat ani nenasazovat PR automaticky.

## Odkazy
https://dev.wix.com/docs/api-reference/business-solutions/gift-cards/gift-cards/introduction
https://dev.wix.com/docs/api-reference/business-solutions/gift-cards/gift-cards/create-gift-card
https://dev.wix.com/docs/api-reference/business-solutions/gift-cards/gift-cards/gift-card-created
https://dev.wix.com/docs/api-reference/business-solutions/e-commerce/payments/gift-cards/gift-cards-service-plugin/introduction
