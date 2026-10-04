import { ChangeDetectorRef, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import {
  AlertController,
  IonBackButton,
  IonButton,
  IonButtons,
  IonCheckbox,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonNote,
  IonSegment,
  IonSegmentButton,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTextarea,
  IonTitle,
  IonToggle,
  IonToolbar,
  ModalController,
  NavController,
  ToastController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { chevronForward, location, trashOutline } from 'ionicons/icons';

import {
  DEFAULT_PEDIGREE_REGISTRY,
  type GeoPoint,
  PET_BREED_OTHER_MAX,
  PET_BREED_OTHER_MIN,
  PET_DESCRIPTION_MAX,
  PET_NAME_MAX,
  PET_PEDIGREE_FIELD_MAX,
  type PetDetail,
  type PetInput,
  type PetSex,
} from '../../../core/models/pet.models';
import { SPECIES_ID } from '../../../core/models/reference.models';
import { ReferenceStore } from '../../../core/reference/reference.store';
import { BreedPickerModalComponent, type BreedPick } from '../components/breed-picker.modal';
import { type Commune, GeoRepository } from '../data/geo.repository';
import { PetsStore } from '../state/pets.store';

const MIN_DATE = '1990-01-01'; // same bound as the CHECK constraints

/** Today as 'YYYY-MM-DD' in local time (toISOString would use UTC). */
function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** A past (or today's) date, not before MIN_DATE. ISO dates compare as strings. */
const pastDate: ValidatorFn = (control) => {
  const value = control.value as string;
  return value && (value < MIN_DATE || value > todayIso()) ? { pastDate: true } : null;
};

type VaccinationGroup = FormGroup<{
  vaccineId: FormControl<number>;
  done: FormControl<boolean>;
  administeredOn: FormControl<string>;
  expiresOn: FormControl<string>;
}>;

function vaccinationValid(group: AbstractControl): ValidationErrors | null {
  const { done, administeredOn, expiresOn } = (group as VaccinationGroup).getRawValue();
  if (!done) return null;
  if (!administeredOn) return { administeredOnRequired: true };
  if (expiresOn && expiresOn <= administeredOn) return { expiresBeforeAdministered: true };
  return null;
}

/** Listed breed, or free text of the right length. */
function breedValid(form: AbstractControl): ValidationErrors | null {
  const { breedIsOther, breedId, breedOther } = form.getRawValue() as { breedIsOther: boolean; breedId: number | null; breedOther: string };
  const length = breedOther.trim().length;
  if (breedIsOther) return length >= PET_BREED_OTHER_MIN && length <= PET_BREED_OTHER_MAX ? null : { breedOther: true };
  return breedId !== null ? null : { breedRequired: true };
}

function pedigreeValid(form: AbstractControl): ValidationErrors | null {
  const { hasPedigree, pedigreeRegistry } = form.getRawValue() as { hasPedigree: boolean; pedigreeRegistry: string };
  return hasPedigree && pedigreeRegistry.trim().length < 2 ? { pedigreeRegistry: true } : null;
}

/** Create (/tabs/pets/new) or edit (/tabs/pets/:petId) a pet. */
@Component({
  selector: 'app-pet-form',
  templateUrl: './pet-form.page.html',
  styleUrl: './pet-form.page.scss',
  imports: [
    ReactiveFormsModule,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonBackButton,
    IonTitle,
    IonContent,
    IonFooter,
    IonButton,
    IonSpinner,
    IonIcon,
    IonInput,
    IonTextarea,
    IonSegment,
    IonSegmentButton,
    IonLabel,
    IonItem,
    IonNote,
    IonToggle,
    IonCheckbox,
    IonSelect,
    IonSelectOption,
  ],
})
export class PetFormPage implements OnInit {
  /** Route parameter (withComponentInputBinding); undefined on /tabs/pets/new. */
  readonly petId = input<string>();

  private readonly store = inject(PetsStore);
  private readonly reference = inject(ReferenceStore);
  private readonly geo = inject(GeoRepository);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly modals = inject(ModalController);
  private readonly alerts = inject(AlertController);
  private readonly toasts = inject(ToastController);
  private readonly nav = inject(NavController);
  private readonly cdr = inject(ChangeDetectorRef);

  protected readonly speciesIds = SPECIES_ID;
  protected readonly limits = {
    name: PET_NAME_MAX,
    breedOther: PET_BREED_OTHER_MAX,
    description: PET_DESCRIPTION_MAX,
    pedigree: PET_PEDIGREE_FIELD_MAX,
  };
  protected readonly minDate = MIN_DATE;
  protected readonly today = todayIso();

  protected readonly form = this.fb.group(
    {
      name: ['', [Validators.required, Validators.maxLength(PET_NAME_MAX)]],
      sex: this.fb.control<PetSex | ''>('', Validators.required),
      breedIsOther: [false],
      breedId: this.fb.control<number | null>(null),
      breedOther: [''],
      birthDate: ['', [Validators.required, pastDate]],
      description: ['', Validators.maxLength(PET_DESCRIPTION_MAX)],
      hasPedigree: [false],
      pedigreeRegistry: ['', Validators.maxLength(PET_PEDIGREE_FIELD_MAX)],
      pedigreeNumber: ['', Validators.maxLength(PET_PEDIGREE_FIELD_MAX)],
      postalCode: ['', [Validators.required, Validators.pattern(/^\d{5}$/)]],
      city: ['', Validators.required],
      isActive: [true],
      vaccinations: this.fb.array<VaccinationGroup>([]),
    },
    { validators: [breedValid, pedigreeValid] },
  );

  protected readonly isEdit = computed(() => !!this.petId());
  /**
   * Chosen first on creation (null = choice screen), fixed afterwards, so a
   * signal rather than a form control. Dog and cat forms never share input.
   */
  protected readonly species = signal<number | null>(null);
  protected readonly speciesName = computed(() => (this.species() === SPECIES_ID.cat ? 'chat' : 'chien'));
  protected readonly vaccines = computed(() => {
    const species = this.species();
    return species === null ? [] : this.reference.vaccinesOf(species);
  });

  protected readonly loading = signal(true);
  protected readonly loadError = signal(false);
  protected readonly saving = signal(false);

  protected readonly communes = signal<Commune[]>([]);
  protected readonly communeStatus = signal<'idle' | 'loading' | 'found' | 'not-found' | 'error'>('idle');
  /** Centre of the chosen commune; stays null on edit until the commune changes. */
  private readonly location = signal<GeoPoint | null>(null);
  private lookupId = 0;

  constructor() {
    addIcons({ chevronForward, location, trashOutline });
  }

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  protected get vaccinationGroups(): VaccinationGroup[] {
    return this.form.controls.vaccinations.controls;
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.loadError.set(false);
    try {
      await this.reference.ensureLoaded();
      const id = this.petId();
      if (id) {
        this.fill(await this.store.getDetail(id));
      }
    } catch {
      this.loadError.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  // ─── Species & breed ──────────────────────────────────────

  /** Creation only: starts a blank form for this species. */
  protected chooseSpecies(speciesId: number): void {
    this.resetForm();
    this.species.set(speciesId);
    this.buildVaccinations([]);
  }

  /** Creation only: back to the species choice, discarding what was typed. */
  protected async changeSpecies(): Promise<void> {
    if (!this.form.dirty) {
      this.backToSpeciesChoice();
      return;
    }
    const alert = await this.alerts.create({
      header: "Changer d'espèce ?",
      message: 'Les informations déjà saisies seront effacées.',
      buttons: [
        { text: 'Annuler', role: 'cancel' },
        { text: 'Changer', role: 'destructive', handler: () => this.backToSpeciesChoice() },
      ],
    });
    await alert.present();
  }

  private backToSpeciesChoice(): void {
    this.resetForm();
    this.species.set(null);
  }

  private resetForm(): void {
    this.form.reset();
    this.form.controls.vaccinations.clear();
    this.lookupId++; // ignore any commune lookup still in flight
    this.communes.set([]);
    this.communeStatus.set('idle');
    this.location.set(null);
  }

  protected breedLabel(): string {
    const { breedIsOther, breedId } = this.form.getRawValue();
    if (breedIsOther) return 'Autre race';
    return breedId !== null ? this.reference.breedLabel({ breed_id: breedId, breed_other: null }) : 'Choisir';
  }

  protected async pickBreed(): Promise<void> {
    const { breedId, breedIsOther } = this.form.getRawValue();
    const modal = await this.modals.create({
      component: BreedPickerModalComponent,
      componentProps: { speciesId: this.species(), selectedId: breedIsOther ? null : breedId, otherSelected: breedIsOther },
    });
    await modal.present();
    const { data, role } = await modal.onWillDismiss<BreedPick>();
    if (role === 'picked' && data) {
      this.form.patchValue(
        data.kind === 'listed' ? { breedIsOther: false, breedId: data.breedId, breedOther: '' } : { breedIsOther: true, breedId: null },
      );
    }
    this.form.controls.breedId.markAsTouched();
    // Zoneless: nothing else tells Angular this async result changed the view.
    this.cdr.markForCheck();
  }

  protected showBreedError(): boolean {
    return this.form.controls.breedId.touched && this.form.hasError('breedRequired');
  }

  // ─── Pedigree ─────────────────────────────────────────────

  protected onPedigreeToggle(): void {
    const registry = this.form.controls.pedigreeRegistry;
    if (this.form.controls.hasPedigree.value && !registry.value) {
      registry.setValue(DEFAULT_PEDIGREE_REGISTRY[this.species() ?? 0] ?? '');
    }
  }

  // ─── Postal code → commune ────────────────────────────────

  protected onPostalCodeInput(): void {
    const code = this.form.controls.postalCode.value.trim();
    this.form.controls.city.setValue('');
    this.location.set(null);
    this.communes.set([]);
    if (/^\d{5}$/.test(code)) {
      void this.lookupCommunes(code, false);
    } else {
      this.lookupId++; // ignore any lookup still in flight
      this.communeStatus.set('idle');
    }
  }

  protected onCityChange(): void {
    const commune = this.communes().find((c) => c.name === this.form.controls.city.value);
    this.location.set(commune?.centre ?? null);
  }

  /**
   * keepCity: on edit, keep the stored city (and location) unless it no longer
   * matches the postal code's communes.
   */
  private async lookupCommunes(code: string, keepCity: boolean): Promise<void> {
    const id = ++this.lookupId;
    this.communeStatus.set('loading');
    try {
      const communes = await this.geo.communesByPostalCode(code);
      if (id !== this.lookupId) return; // the user typed another code meanwhile
      this.communes.set(communes);
      this.communeStatus.set(communes.length ? 'found' : 'not-found');
      const city = this.form.controls.city;
      if (keepCity && communes.some((c) => c.name === city.value)) return;
      if (communes.length === 1) {
        city.setValue(communes[0].name);
        this.location.set(communes[0].centre);
      } else if (!keepCity) {
        city.setValue('');
      }
    } catch {
      if (id === this.lookupId) this.communeStatus.set('error');
    }
  }

  // ─── Vaccinations ─────────────────────────────────────────

  private buildVaccinations(existing: PetDetail['pet_vaccinations']): void {
    const array = this.form.controls.vaccinations;
    array.clear();
    for (const vaccine of this.vaccines()) {
      const done = existing.find((v) => v.vaccine_id === vaccine.id);
      array.push(
        this.fb.group(
          {
            vaccineId: [vaccine.id],
            done: [!!done],
            administeredOn: [done?.administered_on ?? '', pastDate],
            expiresOn: [done?.expires_on ?? ''],
          },
          { validators: vaccinationValid },
        ),
      );
    }
  }

  // ─── Load / save / delete ─────────────────────────────────

  private fill(pet: PetDetail): void {
    this.species.set(pet.species_id);
    this.form.patchValue({
      name: pet.name,
      sex: pet.sex,
      breedIsOther: pet.breed_other !== null,
      breedId: pet.breed_id,
      breedOther: pet.breed_other ?? '',
      birthDate: pet.birth_date,
      description: pet.description ?? '',
      hasPedigree: pet.has_pedigree,
      pedigreeRegistry: pet.pedigree_registry ?? '',
      pedigreeNumber: pet.pedigree_number ?? '',
      postalCode: pet.postal_code,
      city: pet.city,
      isActive: pet.is_active,
    });
    this.buildVaccinations(pet.pet_vaccinations);
    // Offers the other communes of the postal code; the stored location is kept.
    void this.lookupCommunes(pet.postal_code, true);
  }

  protected async save(): Promise<void> {
    const speciesId = this.species();
    if (speciesId === null) return;
    if (this.form.invalid || (!this.isEdit() && !this.location())) {
      this.form.markAllAsTouched();
      await this.toast('Quelques champs sont à compléter.', 'warning');
      return;
    }
    const v = this.form.getRawValue();
    const input: PetInput = {
      speciesId,
      name: v.name.trim(),
      sex: v.sex as PetSex,
      breedId: v.breedIsOther ? null : v.breedId,
      breedOther: v.breedIsOther ? v.breedOther.trim() : null,
      birthDate: v.birthDate,
      description: v.description.trim() || null,
      pedigree: v.hasPedigree ? { registry: v.pedigreeRegistry.trim(), number: v.pedigreeNumber.trim() || null } : null,
      postalCode: v.postalCode.trim(),
      city: v.city,
      location: this.location(),
      isActive: v.isActive,
      vaccinations: v.vaccinations
        .filter((x) => x.done)
        .map((x) => ({ vaccine_id: x.vaccineId, administered_on: x.administeredOn, expires_on: x.expiresOn || null })),
    };

    this.saving.set(true);
    try {
      await this.store.save(this.petId() ?? null, input);
      await this.toast(this.isEdit() ? 'Fiche mise à jour 🐾' : `Bienvenue ${input.name} ! 🐾`, 'success');
      await this.nav.navigateBack('/tabs/pets');
    } catch {
      await this.toast("L'enregistrement a échoué. Réessayez.", 'danger');
    } finally {
      this.saving.set(false);
    }
  }

  protected async confirmDelete(): Promise<void> {
    const id = this.petId();
    if (!id) return;
    const alert = await this.alerts.create({
      header: `Supprimer ${this.form.controls.name.value} ?`,
      message: 'Sa fiche, ses vaccins et ses matchs seront définitivement supprimés.',
      buttons: [
        { text: 'Annuler', role: 'cancel' },
        { text: 'Supprimer', role: 'destructive', handler: () => void this.delete(id) },
      ],
    });
    await alert.present();
  }

  private async delete(id: string): Promise<void> {
    try {
      await this.store.remove(id);
      await this.nav.navigateBack('/tabs/pets');
    } catch {
      await this.toast('La suppression a échoué. Réessayez.', 'danger');
    }
  }

  private async toast(message: string, color: 'success' | 'warning' | 'danger'): Promise<void> {
    const toast = await this.toasts.create({ message, color, duration: 2500, position: 'top' });
    await toast.present();
  }
}
