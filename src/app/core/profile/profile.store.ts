import { Injectable, effect, inject, signal, untracked } from '@angular/core';

import { AuthStore } from '../auth/auth.store';
import type { Profile } from '../models/profile.models';
import { ProfileRepository } from './profile.repository';

/** The signed-in owner's profile. Follows the session: loads on sign-in, clears on sign-out. */
@Injectable({ providedIn: 'root' })
export class ProfileStore {
  private readonly auth = inject(AuthStore);
  private readonly repository = inject(ProfileRepository);

  private readonly _profile = signal<Profile | null>(null);
  private readonly _error = signal(false);

  readonly profile = this._profile.asReadonly();
  readonly error = this._error.asReadonly();

  constructor() {
    effect(() => {
      const userId = this.auth.user()?.id;
      untracked(() => {
        if (userId) {
          void this.load(userId);
        } else {
          this._profile.set(null);
        }
      });
    });
  }

  async updateDisplayName(displayName: string): Promise<void> {
    const userId = this.auth.user()?.id;
    if (!userId) throw new Error('Not signed in');
    this._profile.set(await this.repository.updateDisplayName(userId, displayName));
  }

  async reload(): Promise<void> {
    const userId = this.auth.user()?.id;
    if (userId) await this.load(userId);
  }

  private async load(userId: string): Promise<void> {
    if (this._profile()?.id === userId) return;
    this._error.set(false);
    try {
      this._profile.set(await this.repository.getById(userId));
    } catch {
      this._error.set(true);
    }
  }
}
