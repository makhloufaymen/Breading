import { Component, inject } from '@angular/core';
import { IonBadge, IonIcon, IonLabel, IonTabBar, IonTabButton, IonTabs } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { chatbubbles, paw, personCircle, sparkles } from 'ionicons/icons';

import { MatchesStore } from '../../features/matches/state/matches.store';

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

  constructor() {
    addIcons({ sparkles, chatbubbles, paw, personCircle });
  }
}
