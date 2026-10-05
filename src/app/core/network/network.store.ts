import { Injectable, signal } from '@angular/core';
import { Network } from '@capacitor/network';

/**
 * Online/offline status. @capacitor/network uses the OS connectivity on
 * Android/iOS and navigator.onLine in the browser.
 */
@Injectable({ providedIn: 'root' })
export class NetworkStore {
  private readonly _online = signal(true);
  readonly online = this._online.asReadonly();

  /** Called once at startup (app initializer). */
  async init(): Promise<void> {
    try {
      this._online.set((await Network.getStatus()).connected);
      await Network.addListener('networkStatusChange', ({ connected }) => this._online.set(connected));
    } catch {
      // No status available: assume online, requests will tell otherwise.
    }
  }
}
