import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { IonButton, IonButtons, IonContent, IonFooter, IonHeader, IonIcon, IonSpinner, IonToolbar, ModalController } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { close, heart, chevronDown } from 'ionicons/icons';

import { distanceLabel } from '../../../core/models/discover.models';
import type { PetProfile } from '../../../core/models/pet.models';
import { SPECIES_ID } from '../../../core/models/reference.models';
import { ReferenceStore } from '../../../core/reference/reference.store';
import { PetProfileRepository } from '../../../core/pet-profile/pet-profile.repository';
import { PhotosRepository } from '../../../core/photos/photos.repository';
import { petAge } from '../../pipes/pet-age.pipe';
import { PhotoCarouselComponent } from '../photo-carousel/photo-carousel.component';

const dateFormat = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

/**
 * Full profile of another owner's pet (discovery, likes received, matches).
 * With actions, dismisses with role 'like' or 'pass' from its buttons.
 */
@Component({
  selector: 'app-pet-detail-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-buttons slot="end">
          <ion-button (click)="dismiss('close')" aria-label="Fermer"><ion-icon slot="icon-only" name="chevron-down" /></ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      @if (pet(); as pet) {
        <app-photo-carousel [urls]="photoUrls()" [emoji]="emoji()" />
        <div class="body">
          <h1>
            {{ pet.name }}<span class="age">, {{ age() }}</span>
            <span class="sex">{{ pet.sex === 'male' ? '♂ Mâle' : '♀ Femelle' }}</span>
          </h1>
          <div class="chips">
            <span class="chip">{{ breed() }}</span>
            <span class="chip">📍 {{ pet.city }}{{ distance() ? ' · ' + distance() : '' }}</span>
            @if (pet.has_pedigree) {
              <span class="chip gold">🏅 {{ pet.pedigree_registry }}{{ pet.pedigree_number ? ' n° ' + pet.pedigree_number : '' }}</span>
            }
          </div>

          @if (pet.description) {
            <h2>Présentation</h2>
            <p class="description">{{ pet.description }}</p>
          }

          <h2>Vaccins</h2>
          @for (v of vaccinations(); track v.name) {
            <div class="vaccine">
              <strong>{{ v.name }}</strong>
              <span>
                le {{ v.administered }}
                @if (v.expires) {
                  · <span [class.expired]="v.expired">{{ v.expired ? 'expiré le' : "jusqu'au" }} {{ v.expires }}</span>
                }
              </span>
            </div>
          } @empty {
            <p class="muted">Aucun vaccin renseigné.</p>
          }

          @if (pet.owner) {
            <p class="owner">Propriétaire : <strong>{{ pet.owner.display_name }}</strong></p>
          }
          <p class="muted small">Informations déclarées par le propriétaire.</p>
        </div>
      } @else if (error()) {
        <p class="center">Impossible de charger ce profil.</p>
      } @else {
        <div class="center"><ion-spinner name="crescent" color="primary" /></div>
      }
    </ion-content>
    @if (pet() && actions()) {
      <ion-footer class="ion-no-border">
        <div class="actions">
          <button type="button" class="round pass" aria-label="Passer" (click)="dismiss('pass')"><ion-icon name="close" /></button>
          <button type="button" class="round like" aria-label="J'aime" (click)="dismiss('like')"><ion-icon name="heart" /></button>
        </div>
      </ion-footer>
    }
  `,
  styles: `
    ion-toolbar { --background: transparent; }
    .body { padding: var(--app-space-4) var(--app-space-5) var(--app-space-6); }
    h1 { margin: 0; font-size: 1.8rem; font-weight: 900; }
    h1 .age { font-weight: 600; }
    h1 .sex { display: block; margin-top: var(--app-space-1); font-size: 1rem; color: var(--ion-color-medium); font-weight: 700; }
    h2 { margin: var(--app-space-5) 0 var(--app-space-2); font-size: 1.05rem; font-weight: 800; }
    .chips { display: flex; flex-wrap: wrap; gap: var(--app-space-2); margin-top: var(--app-space-3); }
    .chip { padding: var(--app-space-1) var(--app-space-3); border-radius: var(--app-radius-pill); background: var(--app-surface-muted); font-weight: 700; font-size: 0.9rem; }
    .chip.gold { background: var(--ion-color-warning); color: var(--ion-color-warning-contrast); }
    .description { margin: 0; line-height: 1.5; white-space: pre-line; }
    .vaccine { display: flex; flex-direction: column; padding: var(--app-space-2) 0; border-bottom: 1px solid var(--ion-border-color); }
    .vaccine span { color: var(--ion-color-medium); font-size: 0.9rem; }
    .expired { color: var(--ion-color-danger-shade); font-weight: 700; }
    .owner { margin-top: var(--app-space-5); }
    .muted { color: var(--ion-color-medium); }
    .small { font-size: 0.8rem; }
    .center { display: grid; place-items: center; height: 60%; color: var(--ion-color-medium); }
    .actions { display: flex; justify-content: center; gap: var(--app-space-6); padding: var(--app-space-3) 0 calc(var(--app-space-3) + var(--ion-safe-area-bottom, 0px)); }
    .round {
      display: grid;
      place-items: center;
      width: 64px;
      height: 64px;
      border: none;
      border-radius: 50%;
      background: var(--app-surface);
      box-shadow: var(--app-shadow-lifted);
      font-size: 30px;
      transition: transform var(--app-duration-fast) var(--app-ease-bounce);
    }
    .round:active { transform: scale(0.9); }
    .round.pass { color: var(--ion-color-danger); }
    .round.like { color: var(--ion-color-primary-shade); }
  `,
  imports: [IonHeader, IonToolbar, IonButtons, IonButton, IonIcon, IonContent, IonFooter, IonSpinner, PhotoCarouselComponent],
})
export class PetDetailModalComponent implements OnInit {
  /** Passed through ModalController componentProps. */
  readonly petId = input.required<string>();
  readonly distanceKm = input<number | null>(null);
  /** Show the pass/like buttons. */
  readonly actions = input(true);

  // Not named "modal": Ionic writes the <ion-modal> element into that property.
  private readonly modals = inject(ModalController);
  private readonly profiles = inject(PetProfileRepository);
  private readonly photos = inject(PhotosRepository);
  private readonly reference = inject(ReferenceStore);

  protected readonly pet = signal<PetProfile | null>(null);
  protected readonly error = signal(false);

  protected readonly photoUrls = computed(() => (this.pet()?.pet_photos ?? []).map((p) => this.photos.publicUrl(p.path)));
  protected readonly emoji = computed(() => (this.pet()?.species_id === SPECIES_ID.cat ? '🐱' : '🐶'));
  protected readonly age = computed(() => (this.pet() ? petAge(this.pet()!.birth_date) : ''));
  protected readonly breed = computed(() => (this.pet() ? this.reference.breedLabel(this.pet()!) : ''));
  protected readonly distance = computed(() => {
    const km = this.distanceKm();
    return km === null ? '' : distanceLabel(km);
  });
  protected readonly vaccinations = computed(() => {
    const pet = this.pet();
    if (!pet) return [];
    const names = new Map(this.reference.vaccinesOf(pet.species_id).map((v) => [v.id, v.name]));
    const today = new Date().toISOString().slice(0, 10);
    return pet.pet_vaccinations.map((v) => ({
      name: names.get(v.vaccine_id) ?? 'Vaccin',
      administered: dateFormat.format(new Date(v.administered_on)),
      expires: v.expires_on ? dateFormat.format(new Date(v.expires_on)) : null,
      expired: !!v.expires_on && v.expires_on < today,
    }));
  });

  constructor() {
    addIcons({ close, heart, chevronDown });
  }

  async ngOnInit(): Promise<void> {
    try {
      await this.reference.ensureLoaded();
      this.pet.set(await this.profiles.getProfile(this.petId()));
    } catch {
      this.error.set(true);
    }
  }

  protected dismiss(role: 'like' | 'pass' | 'close'): void {
    void this.modals.dismiss(null, role);
  }
}
