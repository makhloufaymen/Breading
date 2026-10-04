import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonButton,
  IonContent,
  IonFab,
  IonFabButton,
  IonHeader,
  IonIcon,
  IonRefresher,
  IonRefresherContent,
  IonRouterLink,
  IonRouterLinkWithHref,
  IonSkeletonText,
  IonTitle,
  IonToolbar,
  type RefresherCustomEvent,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { add, chevronForward, eyeOffOutline, locationOutline } from 'ionicons/icons';

import type { PetListItem } from '../../../core/models/pet.models';
import { SPECIES_ID } from '../../../core/models/reference.models';
import { ReferenceStore } from '../../../core/reference/reference.store';
import { PetAgePipe } from '../../../shared/pipes/pet-age.pipe';
import { EmptyStateComponent } from '../../../shared/ui/empty-state/empty-state.component';
import { PetsStore } from '../state/pets.store';

@Component({
  selector: 'app-my-pets',
  templateUrl: './my-pets.page.html',
  styleUrl: './my-pets.page.scss',
  imports: [
    RouterLink,
    IonRouterLink,
    IonRouterLinkWithHref,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonRefresher,
    IonRefresherContent,
    IonFab,
    IonFabButton,
    IonButton,
    IonIcon,
    IonSkeletonText,
    EmptyStateComponent,
    PetAgePipe,
  ],
})
export class MyPetsPage {
  protected readonly store = inject(PetsStore);
  protected readonly catId = SPECIES_ID.cat;
  private readonly reference = inject(ReferenceStore);

  constructor() {
    addIcons({ add, chevronForward, eyeOffOutline, locationOutline });
  }

  /** Ionic keeps tab pages alive: refresh each time the tab is shown, not only on creation. */
  ionViewWillEnter(): void {
    void this.refresh();
  }

  protected async onRefresh(event: RefresherCustomEvent): Promise<void> {
    await this.refresh();
    await event.target.complete();
  }

  protected emoji(pet: PetListItem): string {
    return pet.species_id === SPECIES_ID.cat ? '🐱' : '🐶';
  }

  protected breed(pet: PetListItem): string {
    return this.reference.breedLabel(pet);
  }

  private async refresh(): Promise<void> {
    // Breed names come from the reference data; a failure there only hides them.
    await Promise.all([this.store.load(), this.reference.ensureLoaded().catch(() => undefined)]);
  }
}
