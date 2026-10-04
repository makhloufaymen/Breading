import { Component, ElementRef, computed, inject, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import {
  ActionSheetController,
  IonBadge,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonRouterLink,
  IonSpinner,
  IonTitle,
  IonToolbar,
  ModalController,
  NavController,
  ToastController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { chevronDown, close, heart, informationCircle, options } from 'ionicons/icons';

import { DEFAULT_FILTERS, type DiscoverFilters, type DiscoverPet, activeFilterCount, distanceLabel } from '../../../core/models/discover.models';
import { SPECIES_ID } from '../../../core/models/reference.models';
import { ReferenceStore } from '../../../core/reference/reference.store';
import { PetsStore } from '../../pets/state/pets.store';
import { petAge } from '../../../shared/pipes/pet-age.pipe';
import { EmptyStateComponent } from '../../../shared/ui/empty-state/empty-state.component';
import { PetDetailModalComponent } from '../../../shared/ui/pet-detail/pet-detail.modal';
import { MatchModalComponent, type MatchPetView } from '../../../shared/ui/match-modal/match-modal.component';
import type { PetCardData } from '../../../shared/ui/pet-card/pet-card.component';
import { type SwipeDirection, SwipeDeckComponent } from '../../../shared/ui/swipe-deck/swipe-deck.component';
import { FiltersModalComponent } from '../components/filters.modal';
import { DiscoverStore } from '../state/discover.store';

@Component({
  selector: 'app-discover',
  templateUrl: './discover.page.html',
  styleUrl: './discover.page.scss',
  imports: [
    RouterLink,
    IonRouterLink,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonBadge,
    IonIcon,
    IonContent,
    IonSpinner,
    EmptyStateComponent,
    SwipeDeckComponent,
  ],
})
export class DiscoverPage {
  protected readonly store = inject(DiscoverStore);
  protected readonly pets = inject(PetsStore);
  private readonly reference = inject(ReferenceStore);
  private readonly modals = inject(ModalController);
  private readonly actionSheets = inject(ActionSheetController);
  private readonly toasts = inject(ToastController);
  private readonly nav = inject(NavController);

  private readonly deck = viewChild(SwipeDeckComponent);
  private readonly likeButton = viewChild<ElementRef<HTMLElement>>('likeButton');

  protected readonly filterCount = computed(() => activeFilterCount(this.store.filters()));
  protected readonly seekerAvatar = computed(() => {
    const path = this.store.seeker()?.pet_photos[0]?.path;
    return path ? this.pets.photoUrl(path) : null;
  });
  protected readonly cards = computed(() => this.store.deck().map((pet) => this.toCard(pet)));

  constructor() {
    addIcons({ chevronDown, close, heart, informationCircle, options });
  }

  /** Tab pages stay alive: refresh my pets (the seeker list) and the deck each time. */
  async ionViewWillEnter(): Promise<void> {
    await Promise.all([this.pets.load(), this.reference.ensureLoaded().catch(() => undefined)]);
    await this.store.ensureLoaded();
  }

  protected emoji(speciesId: number | undefined): string {
    return speciesId === SPECIES_ID.cat ? '🐱' : '🐶';
  }

  protected async chooseSeeker(): Promise<void> {
    const seekers = this.store.seekers();
    if (seekers.length < 2) return;
    const sheet = await this.actionSheets.create({
      header: 'Chercher un partenaire pour…',
      buttons: [
        ...seekers.map((pet) => ({
          text: `${this.emoji(pet.species_id)} ${pet.name}`,
          handler: () => void this.store.selectSeeker(pet.id),
        })),
        { text: 'Annuler', role: 'cancel' },
      ],
    });
    await sheet.present();
  }

  protected async openFilters(): Promise<void> {
    const seeker = this.store.seeker();
    if (!seeker) return;
    const modal = await this.modals.create({
      component: FiltersModalComponent,
      componentProps: { filters: this.store.filters(), speciesId: seeker.species_id },
    });
    await modal.present();
    const { data, role } = await modal.onWillDismiss<DiscoverFilters>();
    if (role === 'apply' && data) await this.store.setFilters(data);
  }

  protected async openDetail(petId: string): Promise<void> {
    const pet = this.store.deck().find((p) => p.id === petId);
    const modal = await this.modals.create({
      component: PetDetailModalComponent,
      componentProps: { petId, distanceKm: pet?.distance_km ?? null },
    });
    await modal.present();
    const { role } = await modal.onWillDismiss();
    // Let the sheet close before the card flies away.
    if (role === 'like' || role === 'pass') await this.swipe(role);
  }

  /** Buttons under the deck: animates the top card, then onSwiped() runs. */
  protected async swipe(direction: SwipeDirection): Promise<void> {
    await this.deck()?.swipe(direction);
  }

  protected openTopDetail(): void {
    const top = this.store.deck()[0];
    if (top) void this.openDetail(top.id);
  }

  protected async onSwiped({ id, direction }: { id: string; direction: SwipeDirection }): Promise<void> {
    if (direction === 'like') this.celebrateLike();
    // Captured before the card leaves the deck, for the match screen.
    const card = this.cards().find((c) => c.id === id);
    const seeker = this.store.seeker();
    try {
      const matchId = await this.store.swipe(id, direction);
      if (matchId && card && seeker) {
        await this.showMatch(
          matchId,
          { name: seeker.name, photoUrl: this.seekerAvatar(), emoji: this.emoji(seeker.species_id) },
          { name: card.name, photoUrl: card.photoUrls[0] ?? null, emoji: card.emoji },
        );
      }
    } catch {
      // The card is gone locally but not saved: it will come back in a later search.
      const toast = await this.toasts.create({ message: 'Action non enregistrée, vérifiez votre connexion.', color: 'danger', duration: 2500, position: 'top' });
      await toast.present();
    }
  }

  protected resetFilters(): Promise<void> {
    return this.store.setFilters(DEFAULT_FILTERS);
  }

  private async showMatch(matchId: string, mine: MatchPetView, other: MatchPetView): Promise<void> {
    void Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => undefined);
    const modal = await this.modals.create({ component: MatchModalComponent, componentProps: { mine, other } });
    await modal.present();
    const { role } = await modal.onWillDismiss();
    if (role === 'message') await this.nav.navigateRoot(['/tabs/matches', matchId]);
  }

  /** Small heart pop + haptic tick (vibration on phones, nothing in the browser). */
  private celebrateLike(): void {
    void Haptics.impact({ style: ImpactStyle.Light }).catch(() => undefined);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    this.likeButton()?.nativeElement.animate(
      [{ transform: 'scale(1)' }, { transform: 'scale(1.3)' }, { transform: 'scale(1)' }],
      { duration: 350, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' },
    );
  }

  private toCard(pet: DiscoverPet): PetCardData {
    return {
      id: pet.id,
      name: pet.name,
      sex: pet.sex,
      age: petAge(pet.birth_date),
      breed: this.reference.breedLabel(pet),
      place: `${pet.city} · ${distanceLabel(pet.distance_km)}`,
      pedigree: pet.has_pedigree,
      photoUrls: pet.photo_paths.map((path) => this.store.photoUrl(path)),
      emoji: this.emoji(pet.species_id),
    };
  }
}
