// Brücke zwischen dem Spiel und iOS: Spielstände dauerhaft sichern, Vollversion kaufen
import { Capacitor, registerPlugin } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

const KKStore = registerPlugin('KKStore');
const PRODUCT = 'kogge_kontor_vollversion';
const PFX = 'kogge-kontor';

// localStorage kann iOS bei Speichermangel leeren. Jede Änderung geht deshalb auch
// in die App-Einstellungen (UserDefaults); beim Start wird von dort zurückgeholt, was fehlt.
async function mirrorStorage() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { keys } = await Preferences.keys();
    await Promise.all(keys.filter(k => k.startsWith(PFX)).map(async k => {
      if (localStorage.getItem(k) != null) return;
      const { value } = await Preferences.get({ key: k });
      if (value != null) localStorage.setItem(k, value);
    }));
  } catch (e) { /* Spiel startet trotzdem */ }
  const proto = Storage.prototype, set = proto.setItem, rem = proto.removeItem;
  proto.setItem = function (k, v) {
    set.call(this, k, v);
    if (this === window.localStorage && String(k).startsWith(PFX)) Preferences.set({ key: String(k), value: String(v) }).catch(() => {});
  };
  proto.removeItem = function (k) {
    rem.call(this, k);
    if (this === window.localStorage && String(k).startsWith(PFX)) Preferences.remove({ key: String(k) }).catch(() => {});
  };
}

if (Capacitor.isNativePlatform()) {
  window.KK_STORE = {
    async price() {
      const r = await KKStore.products({ ids: [PRODUCT] });
      const p = (r.products || [])[0];
      return p ? p.displayPrice : null;
    },
    async owned() {
      const r = await KKStore.owned({ id: PRODUCT });
      return typeof r.owned === 'boolean' ? r.owned : null;
    },
    async buy() {
      const r = await KKStore.purchase({ id: PRODUCT });
      return r.state;
    },
    async restore() {
      const r = await KKStore.restore({ id: PRODUCT });
      return !!r.owned;
    },
  };
}
window.KK_READY = mirrorStorage();
