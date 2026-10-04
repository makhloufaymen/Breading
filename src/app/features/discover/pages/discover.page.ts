import { Component } from '@angular/core';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular';

import { EmptyStateComponent } from '../../../shared/ui/empty-state/empty-state.component';

@Component({
  selector: 'app-discover',
  template: `
    <ion-header [translucent]="true">
      <ion-toolbar>
        <ion-title>Découvrir</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content [fullscreen]="true">
      <ion-header collapse="condense">
        <ion-toolbar>
          <ion-title size="large">Découvrir</ion-title>
        </ion-toolbar>
      </ion-header>
      <app-empty-state
        emoji="🐶"
        title="Bientôt des copains à rencontrer"
        message="Ajoutez votre animal pour découvrir des partenaires compatibles près de chez vous."
      />
    </ion-content>
  `,
  imports: [IonHeader, IonToolbar, IonTitle, IonContent, EmptyStateComponent],
})
export class DiscoverPage {}
