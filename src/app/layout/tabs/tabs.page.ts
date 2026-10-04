import { Component } from '@angular/core';
import { IonIcon, IonLabel, IonTabBar, IonTabButton, IonTabs } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { chatbubbles, paw, personCircle, sparkles } from 'ionicons/icons';

interface TabDef {
  readonly tab: string;
  readonly label: string;
  readonly icon: string;
}

@Component({
  selector: 'app-tabs',
  templateUrl: 'tabs.page.html',
  styleUrls: ['tabs.page.scss'],
  imports: [IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel],
})
export class TabsPage {
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
