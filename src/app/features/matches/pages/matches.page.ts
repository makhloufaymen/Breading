import { Component } from '@angular/core';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular';

import { EmptyStateComponent } from '../../../shared/ui/empty-state/empty-state.component';

@Component({
  selector: 'app-matches',
  template: `
    <ion-header [translucent]="true">
      <ion-toolbar>
        <ion-title>Matchs</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content [fullscreen]="true">
      <ion-header collapse="condense">
        <ion-toolbar>
          <ion-title size="large">Matchs</ion-title>
        </ion-toolbar>
      </ion-header>
      <app-empty-state
        emoji="💞"
        title="Pas encore de match"
        message="Quand un like sera réciproque, vous pourrez discuter ici avec l'autre propriétaire."
      />
    </ion-content>
  `,
  imports: [IonHeader, IonToolbar, IonTitle, IonContent, EmptyStateComponent],
})
export class MatchesPage {}
