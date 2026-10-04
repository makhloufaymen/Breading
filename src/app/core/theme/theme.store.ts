import { DOCUMENT } from '@angular/common';
import { Injectable, effect, inject, signal } from '@angular/core';
import { Preferences } from '@capacitor/preferences';

export type ThemePreference = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'theme-preference';

/**
 * Holds the user's light/dark choice and applies it to <html>.
 * "system" removes both classes so the prefers-color-scheme media query decides.
 */
@Injectable({ providedIn: 'root' })
export class ThemeStore {
  private readonly document = inject(DOCUMENT);
  private readonly _preference = signal<ThemePreference>('system');

  readonly preference = this._preference.asReadonly();

  constructor() {
    effect(() => {
      const pref = this._preference();
      const root = this.document.documentElement.classList;
      root.toggle('theme-light', pref === 'light');
      root.toggle('theme-dark', pref === 'dark');
    });
  }

  async load(): Promise<void> {
    const { value } = await Preferences.get({ key: STORAGE_KEY });
    if (value === 'light' || value === 'dark' || value === 'system') {
      this._preference.set(value);
    }
  }

  async setPreference(pref: ThemePreference): Promise<void> {
    this._preference.set(pref);
    await Preferences.set({ key: STORAGE_KEY, value: pref });
  }
}
