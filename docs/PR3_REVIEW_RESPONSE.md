# PR #3 — vypořádání první kontroly a předání další etapě

Kontrolovaný komentář: PR #3 issuecomment-6780519509. Původní kontrola správně
hodnotila tehdejší B0 jako nehotovou zákaznickou funkci. Tato verze stále
zůstává Draft a není povolením k merge/deploy.

| Připomínka | Výsledek v aktualizaci | Zbývající reálná přejímka |
| --- | --- | --- |
| Quantity=1, chybějící self/other a spodní pole | Nativní controller i model mají 1–10, self/other. Celý widget nyní čtecím způsobem inventarizován včetně doručení a zprávy. Popis, Caudex a původní foto převzaty z veřejné stránky. | Umístění v Wix Studio a vizuální shoda původního společného shellu/checkoutu |
| Chybějí skutečné 5k/10k PDF | Všechny 3 originály načteny ze soukromé větve a SHA souhlasí s přílohami. Loader + dávkový test skutečných PDF a kódů z lokálního testovacího registru. | Fyzický tisk/sken a majitelské schválení souřadnic |
| Není PAID → emise → PDF | Spustitelný offline kontrakt: fresh order read → podpis → test receiver → trvalý transakční fixture registr → skutečný PDF renderer. | Skutečný testovací Wix/Apps Script/Google Sheets stále nepřipojeny; jejich schéma/zdroje chybí |
| Replay/souběh/chyby | Automaticky testovány opakované události, 20 souběžných volání, 6 nezávislých procesů, restart, timeout po commit, PDF fail/retry, změny objednávky, špatná cena/měna/produkt/podpis, QR a částečné fixture čerpání. | Zopakovat stejné scénáře na odděleném skutečném testovacím backendu |

## Co není tvrzeno

- Lokální SQLite fixture není Google Sheets a její ACID transakce neprokazují
  chování neviděného Apps Scriptu. Contract `issueOnce` musí být ověřen přímo
  v jeho stávajícím registru pod odpovídajícím zámkem, včetně neurčitého výsledku.
- Schválení layoutů v jedné integrační fixture je simulované. Dodané manifesty
  mají stále false; fyzický tisk ani schválení majitelem nejsou provedené.
- V přípravě není skutečná Wix pokladna, běžící PAID handler, žádný přepnutý
  odkaz ani odesílání zákazníkům. Požadovaný den/čas je jen návrh metadat;
  automatické plánování e-mailu se nezapíná a ruční předání vyžaduje pravidla.
- Původní index.html / create / lookup / redeem / device / QR / NIIMBOT se touto
  aktualizací nemění. Reálnou tiskárnu, PIN ani reálné Sheets netestujeme.

## Reprodukovatelná validace

```sh
node --test tests/wix-b0.test.mjs tests/wix-integration.test.mjs
node tests/wix-b0.browser.cjs
VOUCHER_ORIGINALS_DIR=/private/originals npm test --prefix tools/pdf
git diff --check
```

Privátní zdroj, kontrolní otisky, import a omezení jsou popsány v
`docs/WIX_B1_TEST_STAGE.md`. Originály ani archiv nevstupují do veřejného PR.
UI test běží bez externích API, s blokací sítě; skutečný asset fotografie je
v testu stubovaný. Čtecí snímky originální desktop/mobil stránky zůstávají
soukromé. V testu PDF je jeden dřívější volitelný single-original test vynechán,
pokud nejsou nastavené jeho env proměnné; nový all-original test ověřuje všechny
3 soukromé originály v jednom průchodu.

Po aktualizaci následuje samostatná kontrola testovacím agentem na přesném
commitu. Její závěry a případné opravy budou zaznamenané před závěrečným předáním.
