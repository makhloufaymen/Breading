import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, model, signal } from '@angular/core';
import { ActionSheetController, IonIcon, IonSpinner, ToastController } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { camera, star } from 'ionicons/icons';

import { PET_PHOTOS_MAX } from '../../../core/models/pet.models';
import { PhotoPicker, isPickCancelled } from '../../../core/photos/photo-picker';
import { type PhotoDraft, type StoredPhotoDraft, movePhoto } from '../state/photo-draft';

/**
 * Photo editor of the pet form: add (camera/gallery), reorder, delete.
 * Nothing is sent to the server here; the page saves the changes with the form.
 */
@Component({
  selector: 'app-pet-photos',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="grid">
      @for (photo of photos(); track photo.key; let i = $index) {
        <button type="button" class="tile" [attr.aria-label]="'Photo ' + (i + 1) + ', options'" (click)="openOptions(i)">
          <img [src]="photo.url" alt="" loading="lazy" />
          @if (i === 0) {
            <span class="main"><ion-icon name="star" aria-hidden="true" /> Principale</span>
          }
        </button>
      }
      @for (i of processingTiles(); track i) {
        <div class="tile busy"><ion-spinner name="crescent" /></div>
      }
      @if (remaining() > 0) {
        <button type="button" class="tile add" (click)="chooseSource()">
          <ion-icon name="camera" aria-hidden="true" />
          <span>Ajouter</span>
        </button>
      }
    </div>
    <p class="hint">{{ photos().length }}/{{ max }} · Touchez une photo pour la déplacer ou la supprimer.</p>
  `,
  styles: `
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--app-space-2); }
    .tile {
      position: relative;
      aspect-ratio: 1;
      padding: 0;
      overflow: hidden;
      border: none;
      border-radius: var(--app-radius-md);
      background: var(--app-surface-muted);
      font: inherit;
      animation: app-fade-up var(--app-duration-base) var(--app-ease-soft) both;
      transition: transform var(--app-duration-fast) var(--app-ease-bounce);
    }
    .tile:active { transform: scale(0.95); }
    img { display: block; width: 100%; height: 100%; object-fit: cover; }
    .main {
      position: absolute;
      left: var(--app-space-1);
      bottom: var(--app-space-1);
      display: inline-flex;
      align-items: center;
      gap: 2px;
      padding: 2px var(--app-space-2);
      border-radius: var(--app-radius-pill);
      background: var(--ion-color-primary);
      color: var(--ion-color-primary-contrast);
      font-size: 0.7rem;
      font-weight: 800;
    }
    .busy { display: grid; place-items: center; }
    .add {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--app-space-1);
      border: 2px dashed var(--ion-color-primary);
      color: var(--ion-color-primary-shade);
      font-weight: 700;
    }
    .add ion-icon { font-size: 28px; }
    .hint { margin: var(--app-space-2) 0 0; font-size: 0.85rem; color: var(--ion-color-medium); }
  `,
  imports: [IonIcon, IonSpinner],
})
export class PetPhotosComponent {
  /** Current photos, in order (two-way: [(photos)]). */
  readonly photos = model.required<PhotoDraft[]>();
  /** Stored photos the user removed, to delete on save (two-way: [(removed)]). */
  readonly removed = model.required<StoredPhotoDraft[]>();

  private readonly picker = inject(PhotoPicker);
  private readonly actionSheets = inject(ActionSheetController);
  private readonly toasts = inject(ToastController);

  protected readonly max = PET_PHOTOS_MAX;
  private readonly processing = signal(0);
  protected readonly processingTiles = computed(() => Array.from({ length: this.processing() }, (_, i) => i));
  protected readonly remaining = computed(() => PET_PHOTOS_MAX - this.photos().length - this.processing());

  constructor() {
    addIcons({ camera, star });
    // Object URLs keep their blob in memory until revoked.
    inject(DestroyRef).onDestroy(() => revokeNewPhotoUrls(this.photos()));
  }

  protected async chooseSource(): Promise<void> {
    const sheet = await this.actionSheets.create({
      header: 'Ajouter des photos',
      buttons: [
        { text: 'Prendre une photo', handler: () => void this.add('camera') },
        { text: 'Choisir dans la galerie', handler: () => void this.add('gallery') },
        { text: 'Annuler', role: 'cancel' },
      ],
    });
    await sheet.present();
  }

  protected async openOptions(index: number): Promise<void> {
    const last = this.photos().length - 1;
    const sheet = await this.actionSheets.create({
      header: index === 0 ? 'Photo principale' : `Photo ${index + 1}`,
      buttons: [
        ...(index > 0 ? [{ text: 'Mettre en photo principale', handler: () => this.move(index, 0) }] : []),
        ...(index > 0 ? [{ text: 'Déplacer vers la gauche', handler: () => this.move(index, index - 1) }] : []),
        ...(index < last ? [{ text: 'Déplacer vers la droite', handler: () => this.move(index, index + 1) }] : []),
        { text: 'Supprimer', role: 'destructive', handler: () => this.remove(index) },
        { text: 'Annuler', role: 'cancel' },
      ],
    });
    await sheet.present();
  }

  private async add(source: 'camera' | 'gallery'): Promise<void> {
    const limit = this.remaining();
    if (limit <= 0) return;
    // Shown as spinners while photos are resized (the count is only known for the camera).
    this.processing.update((n) => n + 1);
    try {
      const blobs = source === 'camera' ? [await this.picker.takePhoto()] : await this.picker.chooseFromGallery(limit);
      const added: PhotoDraft[] = blobs.map((blob) => ({
        kind: 'new',
        key: crypto.randomUUID(),
        blob,
        url: URL.createObjectURL(blob),
      }));
      this.photos.update((photos) => [...photos, ...added].slice(0, PET_PHOTOS_MAX));
    } catch (error) {
      if (!isPickCancelled(error)) {
        await this.toast("Impossible d'utiliser cette photo. Essayez-en une autre (JPEG ou PNG).");
      }
    } finally {
      this.processing.update((n) => n - 1);
    }
  }

  private move(from: number, to: number): void {
    this.photos.update((photos) => movePhoto(photos, from, to));
  }

  private remove(index: number): void {
    const photo = this.photos()[index];
    this.photos.update((photos) => photos.filter((_, i) => i !== index));
    if (photo.kind === 'stored') {
      this.removed.update((removed) => [...removed, photo]);
    } else {
      URL.revokeObjectURL(photo.url);
    }
  }

  private async toast(message: string): Promise<void> {
    const toast = await this.toasts.create({ message, color: 'danger', duration: 3000, position: 'top' });
    await toast.present();
  }
}

export function revokeNewPhotoUrls(photos: readonly PhotoDraft[]): void {
  for (const photo of photos) {
    if (photo.kind === 'new') URL.revokeObjectURL(photo.url);
  }
}
