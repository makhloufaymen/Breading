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
  IonTitle,
  IonToolbar,
  ToastController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { logOutOutline } from 'ionicons/icons';

import { AuthStore } from '../../../core/auth/auth.store';
import { ThemeStore } from '../../../core/theme/theme.store';

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
  ],
})
export class AccountPage {
  protected readonly theme = inject(ThemeStore);
  private readonly auth = inject(AuthStore);
  private readonly alerts = inject(AlertController);
  private readonly toasts = inject(ToastController);

  // From the sign-up metadata for now; step 2 reads (and edits) the profiles table.
  protected readonly displayName = computed(
    () => (this.auth.user()?.user_metadata['display_name'] as string | undefined) ?? 'Propriétaire',
  );
  protected readonly email = computed(() => this.auth.user()?.email ?? '');
  protected readonly initial = computed(() => this.displayName().charAt(0).toUpperCase());

  constructor() {
    addIcons({ logOutOutline });
  }

  protected onThemeChange(value: unknown): void {
    if (value === 'system' || value === 'light' || value === 'dark') {
      void this.theme.setPreference(value);
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
      const toast = await this.toasts.create({
        message: 'La déconnexion a échoué. Réessayez.',
        duration: 3000,
        color: 'danger',
        position: 'top',
      });
      await toast.present();
    }
  }
}
