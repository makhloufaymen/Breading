import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonSearchbar,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { apps, checkmark, create } from 'ionicons/icons';

import { ReferenceStore } from '../../../core/reference/reference.store';

/** Result of the picker: a listed breed, the free-text "autre race" option, or (filter mode) any breed. */
export type BreedPick =
  | { readonly kind: 'listed'; readonly breedId: number }
  | { readonly kind: 'other' }
  | { readonly kind: 'any' };

/** Lower-case and without accents, so "epagneul" finds "Épagneul". */
function normalize(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

/**
 * Full-screen searchable list of breeds (195 dog breeds is too many for an ion-select).
 * Pet form: offers "Autre race". Discovery filters (filterMode): offers "Toutes les races".
 */
@Component({
  selector: 'app-breed-picker-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button (click)="close()">Annuler</ion-button>
        </ion-buttons>
        <ion-title>Race</ion-title>
      </ion-toolbar>
      <ion-toolbar>
        <ion-searchbar placeholder="Rechercher une race" [debounce]="150" (ionInput)="query.set($event.detail.value ?? '')" />
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <ion-list>
        @if (filterMode()) {
          <ion-item button [detail]="false" (click)="pickAny()">
            <ion-icon slot="start" name="apps" color="primary" />
            <ion-label><strong>Toutes les races</strong></ion-label>
            @if (selectedId() === null) {
              <ion-icon slot="end" name="checkmark" color="primary" />
            }
          </ion-item>
        } @else {
          <ion-item button [detail]="false" (click)="pickOther()">
            <ion-icon slot="start" name="create" color="primary" />
            <ion-label>
              <strong>Autre race</strong>
              <p>Elle n'est pas dans la liste : je la saisis</p>
            </ion-label>
            @if (otherSelected()) {
              <ion-icon slot="end" name="checkmark" color="primary" />
            }
          </ion-item>
        }
        @for (breed of filtered(); track breed.id) {
          <ion-item button [detail]="false" (click)="pick(breed.id)">
            <ion-label>{{ breed.name }}</ion-label>
            @if (breed.id === selectedId()) {
              <ion-icon slot="end" name="checkmark" color="primary" />
            }
          </ion-item>
        } @empty {
          <p class="none">Aucune race ne correspond.</p>
        }
      </ion-list>
    </ion-content>
  `,
  styles: `
    strong { font-weight: 800; }
    .none { padding: var(--app-space-5); text-align: center; color: var(--ion-color-medium); }
  `,
  imports: [IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonSearchbar, IonContent, IonList, IonItem, IonLabel, IonIcon],
})
export class BreedPickerModalComponent {
  /** Passed through ModalController componentProps. */
  readonly speciesId = input.required<number>();
  readonly selectedId = input<number | null>(null);
  readonly otherSelected = input(false);
  readonly filterMode = input(false);

  // Not named "modal": Ionic writes the <ion-modal> element into that property.
  private readonly modals = inject(ModalController);
  private readonly reference = inject(ReferenceStore);

  protected readonly query = signal('');
  protected readonly filtered = computed(() => {
    const breeds = this.reference.breedsOf(this.speciesId());
    const query = normalize(this.query().trim());
    return query ? breeds.filter((b) => normalize(b.name).includes(query)) : breeds;
  });

  constructor() {
    addIcons({ apps, checkmark, create });
  }

  protected pick(breedId: number): void {
    void this.modals.dismiss({ kind: 'listed', breedId } satisfies BreedPick, 'picked');
  }

  protected pickOther(): void {
    void this.modals.dismiss({ kind: 'other' } satisfies BreedPick, 'picked');
  }

  protected pickAny(): void {
    void this.modals.dismiss({ kind: 'any' } satisfies BreedPick, 'picked');
  }

  protected close(): void {
    void this.modals.dismiss(null, 'cancel');
  }
}
