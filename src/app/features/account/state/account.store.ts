import { Injectable, effect, inject, signal, untracked } from '@angular/core';

import { AuthStore } from '../../../core/auth/auth.store';
import { type BlockedOwner, SafetyRepository } from '../../../core/safety/safety.repository';
import { AccountRepository } from '../data/account.repository';

/** Account screen data: blocked owners, account deletion. Cleared on sign-out. */
@Injectable({ providedIn: 'root' })
export class AccountStore {
  private readonly auth = inject(AuthStore);
  private readonly safety = inject(SafetyRepository);
  private readonly repository = inject(AccountRepository);

  private readonly _blocked = signal<BlockedOwner[]>([]);
  readonly blocked = this._blocked.asReadonly();

  constructor() {
    effect(() => {
      const signedIn = !!this.auth.user();
      untracked(() => {
        if (!signedIn) this._blocked.set([]);
      });
    });
  }

  async loadBlocked(): Promise<void> {
    this._blocked.set(await this.safety.listBlocked());
  }

  /** Their pets come back in discovery, except those already swiped (matches are not restored). */
  async unblock(ownerId: string): Promise<void> {
    await this.safety.unblock(ownerId);
    this._blocked.update((list) => list.filter((b) => b.id !== ownerId));
  }

  /** Deletes everything server-side, then forgets the (now invalid) local session. */
  async deleteAccount(): Promise<void> {
    await this.repository.deleteAccount();
    await this.auth.signOut().catch(() => undefined);
  }
}
