import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import {
  AlertController,
  IonButton,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonItemOption,
  IonItemOptions,
  IonItemSliding,
  IonLabel,
  IonList,
  IonNote,
  IonRefresher,
  IonRefresherContent,
  IonRouterLink,
  IonSegment,
  IonSegmentButton,
  IonSpinner,
  IonTitle,
  IonToolbar,
  ModalController,
  type RefresherCustomEvent,
  ToastController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { close, heart, heartDislikeOutline } from 'ionicons/icons';

import { distanceLabel } from '../../../core/models/discover.models';
import type { MatchItem, ReceivedLike } from '../../../core/models/match.models';
import { SPECIES_ID } from '../../../core/models/reference.models';
import { ReferenceStore } from '../../../core/reference/reference.store';
import type { SwipeKind } from '../../../core/swipes/swipes.repository';
import { PetsStore } from '../../pets/state/pets.store';
import { PetAgePipe } from '../../../shared/pipes/pet-age.pipe';
import { EmptyStateComponent } from '../../../shared/ui/empty-state/empty-state.component';
import { MatchModalComponent } from '../../../shared/ui/match-modal/match-modal.component';
import { PetDetailModalComponent } from '../../../shared/ui/pet-detail/pet-detail.modal';
import { MatchesStore } from '../state/matches.store';

const dateFormat = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' });

@Component({
  selector: 'app-matches',
  templateUrl: './matches.page.html',
  styleUrl: './matches.page.scss',
  imports: [
    RouterLink,
    IonRouterLink,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonSegment,
    IonSegmentButton,
    IonLabel,
    IonList,
    IonItem,
    IonItemSliding,
    IonItemOptions,
    IonItemOption,
    IonNote,
    IonButton,
    IonIcon,
    IonSpinner,
    IonRefresher,
    IonRefresherContent,
    EmptyStateComponent,
    PetAgePipe,
  ],
})
export class MatchesPage {
  protected readonly store = inject(MatchesStore);
  private readonly pets = inject(PetsStore);
  private readonly reference = inject(ReferenceStore);
  private readonly modals = inject(ModalController);
  private readonly alerts = inject(AlertController);
  private readonly toasts = inject(ToastController);

  protected readonly tab = signal<'matches' | 'likes'>('matches');
  /** Like being answered: its buttons are disabled meanwhile. */
  protected readonly answering = signal<string | null>(null);

  constructor() {
    addIcons({ close, heart, heartDislikeOutline });
  }

  ionViewWillEnter(): void {
    void this.refresh();
  }

  protected async onRefresh(event: RefresherCustomEvent): Promise<void> {
    await this.refresh();
    await event.target.complete();
  }

  protected onTabChange(value: unknown): void {
    if (value === 'matches' || value === 'likes') this.tab.set(value);
  }

  protected emoji(speciesId: number): string {
    return speciesId === SPECIES_ID.cat ? '🐱' : '🐶';
  }

  protected photo(path: string | null | undefined): string | null {
    return path ? this.store.photoUrl(path) : null;
  }

  protected breed(pet: { breed_id: number | null; breed_other: string | null }): string {
    return this.reference.breedLabel(pet);
  }

  protected matchDate(match: MatchItem): string {
    return dateFormat.format(new Date(match.createdAt));
  }

  protected distance(km: number): string {
    return distanceLabel(km);
  }

  /** Step 7 will open the conversation instead. */
  protected async openMatch(match: MatchItem): Promise<void> {
    const modal = await this.modals.create({
      component: PetDetailModalComponent,
      componentProps: { petId: match.other.id, actions: false },
    });
    await modal.present();
  }

  protected async confirmUnmatch(match: MatchItem, sliding?: IonItemSliding): Promise<void> {
    await sliding?.close();
    const alert = await this.alerts.create({
      header: `Annuler le match avec ${match.other.name} ?`,
      message: 'La conversation sera supprimée et vos animaux ne vous seront plus proposés.',
      buttons: [
        { text: 'Garder', role: 'cancel' },
        { text: 'Annuler le match', role: 'destructive', handler: () => void this.unmatch(match) },
      ],
    });
    await alert.present();
  }

  protected async openLike(like: ReceivedLike): Promise<void> {
    const modal = await this.modals.create({
      component: PetDetailModalComponent,
      componentProps: { petId: like.id, distanceKm: like.distance_km },
    });
    await modal.present();
    const { role } = await modal.onWillDismiss();
    if (role === 'like' || role === 'pass') await this.answer(like, role);
  }

  protected async answer(like: ReceivedLike, kind: SwipeKind): Promise<void> {
    this.answering.set(like.id + like.my_pet_id);
    try {
      const matchId = await this.store.answerLike(like, kind);
      if (matchId) await this.celebrate(like);
    } catch {
      await this.toast('Action non enregistrée, vérifiez votre connexion.');
    } finally {
      this.answering.set(null);
    }
  }

  private async celebrate(like: ReceivedLike): Promise<void> {
    void Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => undefined);
    const mine = this.pets.pets().find((p) => p.id === like.my_pet_id);
    const modal = await this.modals.create({
      component: MatchModalComponent,
      componentProps: {
        mine: { name: like.my_pet_name, photoUrl: this.photo(mine?.pet_photos[0]?.path), emoji: this.emoji(like.species_id) },
        other: { name: like.name, photoUrl: this.photo(like.photo_paths[0]), emoji: this.emoji(like.species_id) },
      },
    });
    await modal.present();
    const { role } = await modal.onWillDismiss();
    if (role === 'matches') this.tab.set('matches');
  }

  private async unmatch(match: MatchItem): Promise<void> {
    try {
      await this.store.unmatch(match.id);
    } catch {
      await this.toast("L'annulation a échoué. Réessayez.");
    }
  }

  private async refresh(): Promise<void> {
    // My pets: for their photos on the match screen. Reference data: breed names.
    await Promise.all([
      this.store.load(),
      this.pets.load(),
      this.reference.ensureLoaded().catch(() => undefined),
    ]);
  }

  private async toast(message: string): Promise<void> {
    const toast = await this.toasts.create({ message, color: 'danger', duration: 2500, position: 'top' });
    await toast.present();
  }
}
