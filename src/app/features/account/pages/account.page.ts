import { Component, computed, inject, signal } from '@angular/core';
import {
  AlertController,
  IonButton,
  IonContent,
  IonHeader,
  IonIcon,
  IonLabel,
  IonList,
  IonListHeader,
  IonItem,
  IonNote,
  IonSegment,
  IonSegmentButton,
  IonSkeletonText,
  IonTitle,
  IonToolbar,
  ModalController,
  ToastController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { logOutOutline, pencil, trashOutline } from 'ionicons/icons';

import { AuthStore } from '../../../core/auth/auth.store';
import { ProfileStore } from '../../../core/profile/profile.store';
import { ThemeStore } from '../../../core/theme/theme.store';
import { EditNameModalComponent } from '../components/edit-name.modal';
import { AccountStore } from '../state/account.store';

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
    IonItem,
    IonNote,
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
  protected readonly account = inject(AccountStore);
  private readonly auth = inject(AuthStore);
  private readonly alerts = inject(AlertController);
  private readonly modals = inject(ModalController);
  private readonly toasts = inject(ToastController);

  protected readonly displayName = computed(() => this.profiles.profile()?.display_name ?? '');
  protected readonly email = computed(() => this.auth.user()?.email ?? '');
  protected readonly deleting = signal(false);
  protected readonly initial = computed(() => this.displayName().charAt(0).toUpperCase());

  constructor() {
    addIcons({ logOutOutline, pencil, trashOutline });
  }

  ionViewWillEnter(): void {
    void this.account.loadBlocked().catch(() => undefined);
  }

  protected async unblock(ownerId: string, name: string): Promise<void> {
    try {
      await this.account.unblock(ownerId);
      await this.toast(`${name} est débloqué.`, 'success');
    } catch {
      await this.toast('Le déblocage a échoué. Réessayez.', 'danger');
    }
  }

  /** Store requirement: deletion from the app. Typed confirmation, the action is irreversible. */
  protected async confirmDelete(): Promise<void> {
    const alert = await this.alerts.create({
      header: 'Supprimer votre compte ?',
      message: 'Vos animaux, photos, matchs et messages seront définitivement supprimés. Tapez SUPPRIMER pour confirmer.',
      inputs: [{ name: 'confirm', type: 'text', placeholder: 'SUPPRIMER', attributes: { autocapitalize: 'characters' } }],
      buttons: [
        { text: 'Annuler', role: 'cancel' },
        {
          text: 'Supprimer',
          role: 'destructive',
          // Returning false keeps the alert open.
          handler: (values: { confirm?: string }) => (values.confirm?.trim().toUpperCase() === 'SUPPRIMER' ? undefined : false),
        },
      ],
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    if (role === 'destructive') await this.deleteAccount();
  }

  private async deleteAccount(): Promise<void> {
    this.deleting.set(true);
    try {
      // AppComponent notices the session is gone and navigates to /login.
      await this.account.deleteAccount();
      await this.toast('Votre compte a été supprimé. Au revoir 🐾', 'success');
    } catch {
      await this.toast('La suppression a échoué. Réessayez.', 'danger');
    } finally {
      this.deleting.set(false);
    }
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
