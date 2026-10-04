import { Component, computed, inject } from '@angular/core';
import {
  AlertController,
  IonButton,
  IonContent,
  IonHeader,
  IonIcon,
  IonLabel,
  IonList,
  IonListHeader,
  IonSegment,
  IonSegmentButton,
  IonSkeletonText,
  IonTitle,
  IonToolbar,
  ModalController,
  ToastController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { logOutOutline, pencil } from 'ionicons/icons';

import { AuthStore } from '../../../core/auth/auth.store';
import { ProfileStore } from '../../../core/profile/profile.store';
import { ThemeStore } from '../../../core/theme/theme.store';
import { EditNameModalComponent } from '../components/edit-name.modal';

@Component({
  selector: 'app-account',
  templateUrl: './account.page.html',
  styleUrl: './account.page.scss',
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonList,
    IonListHeader,
    IonLabel,
    IonSegment,
    IonSegmentButton,
    IonButton,
    IonIcon,
    IonSkeletonText,
  ],
})
export class AccountPage {
  protected readonly theme = inject(ThemeStore);
  protected readonly profiles = inject(ProfileStore);
  private readonly auth = inject(AuthStore);
  private readonly alerts = inject(AlertController);
  private readonly modals = inject(ModalController);
  private readonly toasts = inject(ToastController);

  protected readonly displayName = computed(() => this.profiles.profile()?.display_name ?? '');
  protected readonly email = computed(() => this.auth.user()?.email ?? '');
  protected readonly initial = computed(() => this.displayName().charAt(0).toUpperCase());

  constructor() {
    addIcons({ logOutOutline, pencil });
  }

  protected onThemeChange(value: unknown): void {
    if (value === 'system' || value === 'light' || value === 'dark') {
      void this.theme.setPreference(value);
    }
  }

  protected async editName(): Promise<void> {
    const modal = await this.modals.create({
      component: EditNameModalComponent,
      componentProps: { currentName: this.displayName() },
      // Bottom sheet that stops at 45% of the screen height.
      breakpoints: [0, 0.45],
      initialBreakpoint: 0.45,
    });
    await modal.present();
    const { role } = await modal.onWillDismiss();
    if (role === 'saved') {
      await this.toast('Nom mis à jour 🎉', 'success');
    }
  }

  protected async confirmSignOut(): Promise<void> {
    const alert = await this.alerts.create({
      header: 'Se déconnecter ?',
      message: 'Vous pourrez vous reconnecter à tout moment.',
      buttons: [
        { text: 'Annuler', role: 'cancel' },
        { text: 'Se déconnecter', role: 'destructive', handler: () => void this.signOut() },
      ],
    });
    await alert.present();
  }

  private async signOut(): Promise<void> {
    try {
      // AppComponent notices the session is gone and navigates to /login.
      await this.auth.signOut();
    } catch {
      await this.toast('La déconnexion a échoué. Réessayez.', 'danger');
    }
  }

  private async toast(message: string, color: 'success' | 'danger'): Promise<void> {
    const toast = await this.toasts.create({ message, color, duration: 2500, position: 'top' });
    await toast.present();
  }
}
