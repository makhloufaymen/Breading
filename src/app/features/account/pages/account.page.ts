import { Component, inject } from '@angular/core';
import {
  IonContent,
  IonHeader,
  IonLabel,
  IonList,
  IonListHeader,
  IonSegment,
  IonSegmentButton,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';

import { ThemeStore } from '../../../core/theme/theme.store';

@Component({
  selector: 'app-account',
  template: `
    <ion-header [translucent]="true">
      <ion-toolbar>
        <ion-title>Compte</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content [fullscreen]="true">
      <ion-header collapse="condense">
        <ion-toolbar>
          <ion-title size="large">Compte</ion-title>
        </ion-toolbar>
      </ion-header>

      <ion-list lines="none" class="ion-padding-horizontal">
        <ion-list-header>
          <ion-label>Apparence</ion-label>
        </ion-list-header>
        <ion-segment [value]="theme.preference()" (ionChange)="onThemeChange($event.detail.value)">
          <ion-segment-button value="system"><ion-label>Auto</ion-label></ion-segment-button>
          <ion-segment-button value="light"><ion-label>Clair</ion-label></ion-segment-button>
          <ion-segment-button value="dark"><ion-label>Sombre</ion-label></ion-segment-button>
        </ion-segment>
      </ion-list>
    </ion-content>
  `,
  imports: [IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonListHeader, IonLabel, IonSegment, IonSegmentButton],
})
export class AccountPage {
  protected readonly theme = inject(ThemeStore);

  protected onThemeChange(value: unknown): void {
    if (value === 'system' || value === 'light' || value === 'dark') {
      void this.theme.setPreference(value);
    }
  }
}
