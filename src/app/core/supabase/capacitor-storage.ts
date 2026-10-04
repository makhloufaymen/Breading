import { Preferences } from '@capacitor/preferences';
import type { SupportedStorage } from '@supabase/supabase-js';

/**
 * Stores the Supabase session with Capacitor Preferences instead of localStorage.
 * On iOS the WebView's localStorage can be purged by the system, which would
 * silently log the user out. Preferences maps to UserDefaults (iOS) and
 * SharedPreferences (Android), and to localStorage in the browser.
 */
export const capacitorStorage: SupportedStorage = {
  async getItem(key) {
    const { value } = await Preferences.get({ key });
    return value;
  },
  async setItem(key, value) {
    await Preferences.set({ key, value });
  },
  async removeItem(key) {
    await Preferences.remove({ key });
  },
};
