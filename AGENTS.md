# AGENTS.md — Zlatnická dílna Koneční / voucher-konecni

## Co je tento projekt
Toto je **pracovní kopie**, nikoli ostrá instalace voucherů. Ostrá webová aplikace běží odděleně na účtu `Dilnakk/voucher` a používá jiný Apps Script a Google Sheets. Do produkce nic nenasazovat.

Front-end: statický `index.html` (GitHub Pages).
Existující API: Google Apps Script přes formulář POST do skrytého iframe, používá `action: "create"`, `"lookup"`, `"redeem"`, `"device-status"`, `"register-device"`. Existující registrace zařízení, PIN, QR a tisk NIIMBOT musí fungovat beze změn.
Backend Google Apps Script a schéma Google Sheets **nejsou** v repozitáři ověřené. NEPŘEDPOKLÁDEJ jejich tvar, neobcházej stávající bezpečnost a nežádej tajné hodnoty do GitHubu.

## Zásady pro všechny agenty
- Pracuj výhradně na testovací větvi (ne `main`), nevytvářej PR do `Dilnakk/voucher`; žádný deploy, žádné automatické slučování.
- Žádný reálný voucher ani zápis do ostré tabulky. Pro test vytvoř testovací `Spreadsheet` a testovací deployment Apps Scriptu se samostatným klíčem a oddělenou konfigurací.
- Zachovej existující `create`, `lookup`, `redeem`, autorizaci zařízení, QR obsahující pouhý kód voucheru a tisk štítků 30×20 mm.
- Údaje o objednávkách a platebním stavu nejsou veřejné. Žádné API klíče, PIN, deviceToken, e-mail zákazníka ani ID citlivých tabulek do commitu nebo logu. Tokeny ukládej jen na backendu (ScriptProperties/Wix Secrets).
- Vydání poukazu může nastat pouze po serverově ověřené autorizaci a po **potvrzené platbě**. Pro bankovní převod v první fázi toto potvrzuje pověřený pracovník po kontrole banky. Zákazník nikdy nemůže vygenerovat voucher z otevřené webové stránky.
- Idempotence: unikátní `wixOrderId` + `wixLineItemId` + jednotka/kus; retry, dvojklik a souběh nesmějí vydat další platný voucher. Použij serverovou atomickou kontrolu (LockService), audit a statusy.
- PDF může selhat; regeneruj jej **ze stejného již vydaného kódu**, nikdy nevytvářej další voucher.
- Zachovej možnost později přepnout aktivaci po potvrzeném zaplacení objednávky ve Wixu. Příchozí webhook bez serverového ověření není důkaz platby.
- Neznáme, zda aktuální Wix tlačítko prodává **Wix Gift Cards** nebo vlastní produkt. Před jakýmkoli napojením odesílání kódů prověř, zda Wix sám nevydává druhý kód. Zabránit dvěma nezávislým evidencím.
- **Vydání** voucheru a **uplatnění** voucheru při Wix checkoutu jsou oddělené úkoly. Nenazývej online uplatnění hotovým, dokud není skutečně implementováno a ověřeno.
- Před předáním připrav dokumentovaný diff, reprodukovatelné testy, rizika a rollback.

## Agent práce
Přesné zadání vývojového a testovacího agenta: `docs/ONLINE_VOUCHERY_WIX.md`.
Codex má tento soubor načíst před změnou kódu.
