import { Component } from '@angular/core';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular';

import { EmptyStateComponent } from '../../../shared/ui/empty-state/empty-state.component';

@Component({
  selector: 'app-my-pets',
  template: `
    <ion-header [translucent]="true">
      <ion-toolbar>
        <ion-title>Mes animaux</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content [fullscreen]="true">
      <ion-header collapse="condense">
        <ion-toolbar>
          <ion-title size="large">Mes animaux</ion-title>
        </ion-toolbar>
      </ion-header>
      <app-empty-state
        emoji="🐱"
        title="Aucun animal pour l'instant"
        message="Créez la fiche de votre chien ou de votre chat pour commencer."
      />
    </ion-content>
  `,
  imports: [IonHeader, IonToolbar, IonTitle, IonContent, EmptyStateComponent],
})
export class MyPetsPage {}
