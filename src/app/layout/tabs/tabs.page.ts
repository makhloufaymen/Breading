import { Component, effect, inject, untracked } from '@angular/core';
import { IonBadge, IonIcon, IonLabel, IonTabBar, IonTabButton, IonTabs, ToastController } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { chatbubbles, paw, personCircle, sparkles } from 'ionicons/icons';

import { NetworkStore } from '../../core/network/network.store';
import { DiscoverStore } from '../../features/discover/state/discover.store';
import { MatchesStore } from '../../features/matches/state/matches.store';
import { PetsStore } from '../../features/pets/state/pets.store';

interface TabDef {
  readonly tab: string;
  readonly label: string;
  readonly icon: string;
}

@Component({
  selector: 'app-tabs',
  templateUrl: 'tabs.page.html',
  styleUrls: ['tabs.page.scss'],
  imports: [IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel, IonBadge],
})
export class TabsPage {
  /** Unread messages badge (the store listens to new messages while signed in). */
  protected readonly matches = inject(MatchesStore);

  protected readonly tabs: readonly TabDef[] = [
    { tab: 'discover', label: 'Découvrir', icon: 'sparkles' },
    { tab: 'matches', label: 'Matchs', icon: 'chatbubbles' },
    { tab: 'pets', label: 'Mes animaux', icon: 'paw' },
    { tab: 'account', label: 'Compte', icon: 'person-circle' },
  ];

  private readonly network = inject(NetworkStore);
  private readonly pets = inject(PetsStore);
  private readonly discover = inject(DiscoverStore);
  private readonly toasts = inject(ToastController);

  constructor() {
    addIcons({ sparkles, chatbubbles, paw, personCircle });

    // Back online: reload what may have failed meanwhile (Realtime reconnects by itself).
    let wasOffline = false;
    effect(() => {
      const online = this.network.online();
      untracked(() => {
        if (online && wasOffline) void this.refreshAfterReconnect();
        wasOffline = !online;
      });
    });
  }

  private async refreshAfterReconnect(): Promise<void> {
    const toast = await this.toasts.create({ message: 'Connexion rétablie 🐾', color: 'success', duration: 2000, position: 'top' });
    await toast.present();
    await Promise.all([
      this.matches.load(),
      this.pets.load(),
      this.discover.status() === 'error' ? this.discover.reload() : Promise.resolve(),
    ]);
  }
}
