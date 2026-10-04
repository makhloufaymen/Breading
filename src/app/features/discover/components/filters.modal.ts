import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonNote,
  IonRange,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { chevronForward } from 'ionicons/icons';

import {
  AGE_FILTER_MAX,
  DEFAULT_FILTERS,
  DISTANCE_FILTER_MAX,
  DISTANCE_FILTER_MIN,
  type DiscoverFilters,
} from '../../../core/models/discover.models';
import { ReferenceStore } from '../../../core/reference/reference.store';

/** ion-range value: a number, or lower/upper with dualKnobs. */
type RangeValue = number | { lower: number; upper: number };
import { BreedPickerModalComponent, type BreedPick } from '../../../shared/ui/breed-picker/breed-picker.modal';

/** Discovery filters sheet. Dismisses with role 'apply' and the new filters. */
@Component({
  selector: 'app-filters-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button (click)="close()">Annuler</ion-button>
        </ion-buttons>
        <ion-title>Filtres</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="reset()">Réinitialiser</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <p class="fixed">Même espèce et sexe opposé : c'est automatique.</p>

      <section>
        <ion-item class="picker" button lines="none" [detail]="false" (click)="pickBreed()">
          <ion-label>Race</ion-label>
          <ion-note slot="end">{{ breedLabel() }}</ion-note>
          <ion-icon slot="end" name="chevron-forward" aria-hidden="true" />
        </ion-item>
      </section>

      <section>
        <h3>Âge <span>{{ ageLabel() }}</span></h3>
        <ion-range
          [dualKnobs]="true"
          [min]="0"
          [max]="ageMax"
          [step]="1"
          [snaps]="true"
          [pin]="true"
          [pinFormatter]="agePin"
          [value]="{ lower: minAge(), upper: maxAge() }"
          (ionInput)="onAge($event.detail.value)"
        />
      </section>

      <section>
        <h3>Distance <span>{{ distanceLabel() }}</span></h3>
        <ion-range
          [min]="distanceMin"
          [max]="distanceMax"
          [step]="10"
          [pin]="true"
          [pinFormatter]="distancePin"
          [value]="distance()"
          (ionInput)="onDistance($event.detail.value)"
        />
      </section>
    </ion-content>
    <ion-footer>
      <ion-toolbar>
        <ion-button expand="block" (click)="apply()">Voir les profils</ion-button>
      </ion-toolbar>
    </ion-footer>
  `,
  styles: `
    .fixed { margin: 0 0 var(--app-space-4); color: var(--ion-color-medium); font-size: 0.9rem; }
    section { margin-bottom: var(--app-space-5); }
    h3 { display: flex; justify-content: space-between; margin: 0 0 var(--app-space-2); font-size: 1rem; font-weight: 800; }
    h3 span { color: var(--ion-color-primary-shade); }
    .picker { --background: var(--app-surface-muted); --border-radius: var(--app-radius-md); font-weight: 700; }
    .picker ion-note { color: var(--ion-text-color); font-weight: 700; }
    ion-footer ion-toolbar { --padding-start: var(--app-space-4); --padding-end: var(--app-space-4); }
  `,
  imports: [IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent, IonFooter, IonItem, IonLabel, IonNote, IonIcon, IonRange],
})
export class FiltersModalComponent implements OnInit {
  /** Passed through ModalController componentProps. */
  readonly filters = input.required<DiscoverFilters>();
  readonly speciesId = input.required<number>();

  // Not named "modal": Ionic writes the <ion-modal> element into that property.
  private readonly modals = inject(ModalController);
  private readonly reference = inject(ReferenceStore);

  protected readonly ageMax = AGE_FILTER_MAX;
  protected readonly distanceMin = DISTANCE_FILTER_MIN;
  protected readonly distanceMax = DISTANCE_FILTER_MAX;

  protected readonly breedId = signal<number | null>(null);
  protected readonly minAge = signal(0);
  /** Slider value; AGE_FILTER_MAX means "no maximum". */
  protected readonly maxAge = signal(AGE_FILTER_MAX);
  /** Slider value; DISTANCE_FILTER_MAX means "anywhere". */
  protected readonly distance = signal(DISTANCE_FILTER_MAX);

  protected readonly breedLabel = computed(() => {
    const id = this.breedId();
    return id === null ? 'Toutes' : this.reference.breedLabel({ breed_id: id, breed_other: null });
  });
  protected readonly ageLabel = computed(() => {
    const [min, max] = [this.minAge(), this.maxAge()];
    if (min === 0 && max === AGE_FILTER_MAX) return 'Tous âges';
    if (max === AGE_FILTER_MAX) return `${min} ans et plus`;
    return `${min} à ${max} ${max > 1 ? 'ans' : 'an'}`;
  });
  protected readonly distanceLabel = computed(() =>
    this.distance() === DISTANCE_FILTER_MAX ? 'Toute la France' : `Jusqu'à ${this.distance()} km`,
  );

  protected readonly agePin = (value: number): string => (value === AGE_FILTER_MAX ? `${value}+` : String(value));
  protected readonly distancePin = (value: number): string => (value === DISTANCE_FILTER_MAX ? '∞' : `${value}`);

  constructor() {
    addIcons({ chevronForward });
  }

  ngOnInit(): void {
    this.load(this.filters());
  }

  protected onAge(value: RangeValue): void {
    if (typeof value === 'object') {
      this.minAge.set(value.lower);
      this.maxAge.set(value.upper);
    }
  }

  protected onDistance(value: RangeValue): void {
    if (typeof value === 'number') this.distance.set(value);
  }

  protected async pickBreed(): Promise<void> {
    const picker = await this.modals.create({
      component: BreedPickerModalComponent,
      componentProps: { speciesId: this.speciesId(), selectedId: this.breedId(), filterMode: true },
    });
    await picker.present();
    const { data, role } = await picker.onWillDismiss<BreedPick>();
    if (role === 'picked' && data) {
      this.breedId.set(data.kind === 'listed' ? data.breedId : null);
    }
  }

  protected reset(): void {
    this.load(DEFAULT_FILTERS);
  }

  protected close(): void {
    void this.modals.dismiss(null, 'cancel');
  }

  protected apply(): void {
    const filters: DiscoverFilters = {
      breedId: this.breedId(),
      minAgeYears: this.minAge(),
      maxAgeYears: this.maxAge() === AGE_FILTER_MAX ? null : this.maxAge(),
      maxDistanceKm: this.distance() === DISTANCE_FILTER_MAX ? null : this.distance(),
    };
    void this.modals.dismiss(filters, 'apply');
  }

  private load(filters: DiscoverFilters): void {
    this.breedId.set(filters.breedId);
    this.minAge.set(filters.minAgeYears);
    this.maxAge.set(filters.maxAgeYears ?? AGE_FILTER_MAX);
    this.distance.set(filters.maxDistanceKm ?? DISTANCE_FILTER_MAX);
  }
}
