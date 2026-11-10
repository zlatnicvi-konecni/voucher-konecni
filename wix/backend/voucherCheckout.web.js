// Wix Velo source template. Copy only into an isolated Wix development site.
import { webMethod, Permissions } from 'wix-web-module';
// Deliberately fail closed: no cart, order, payment, email or Apps Script call.
// Do not enable by simply removing this return; implement the reviewed contract first.
export const prepareVoucherCheckout = webMethod(Permissions.Anyone, async () => ({
  available: false,
  message: 'Testovací návrh není připojen k pokladně. Objednávka nebyla vytvořena.'
}));
