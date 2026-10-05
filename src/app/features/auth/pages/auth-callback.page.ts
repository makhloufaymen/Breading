import { Component, OnInit, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonButton, IonContent, IonRouterLink, IonSpinner, NavController, ToastController } from '@ionic/angular';

import { AuthStore } from '../../../core/auth/auth.store';

/**
 * Landing of the email confirmation link: /auth/callback?code=… in the browser,
 * or com.breading.app://auth/callback?code=… in the app (AppComponent routes the
 * deep link here). Supabase has already confirmed the email at this point; the
 * one-time code signs the user in.
 */
@Component({
  selector: 'app-auth-callback',
  template: `
    <ion-content>
      <div class="screen">
        @if (failed()) {
          <div class="emoji" aria-hidden="true">🙀</div>
          <h1>Lien expiré ou déjà utilisé</h1>
          <p>
            Votre email est peut-être déjà confirmé. Essayez de vous connecter ; sinon, demandez un nouvel email depuis
            l'écran de connexion.
          </p>
          <ion-button routerLink="/login" routerDirection="root">Se connecter</ion-button>
        } @else {
          <div class="emoji" aria-hidden="true">🐾</div>
          <h1>Confirmation…</h1>
          <ion-spinner name="crescent" color="primary" />
        }
      </div>
    </ion-content>
  `,
  styles: `
    .screen {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--app-space-3);
      min-height: 100%;
      padding: var(--app-space-6);
      text-align: center;
    }
    .emoji { font-size: 64px; animation: app-float 3.2s ease-in-out infinite; }
    h1 { margin: 0; font-weight: 900; }
    p { max-width: 320px; color: var(--ion-color-medium); line-height: 1.5; }
  `,
  imports: [RouterLink, IonRouterLink, IonContent, IonButton, IonSpinner],
})
export class AuthCallbackPage implements OnInit {
  /** Query parameters (withComponentInputBinding). */
  readonly code = input<string>();
  readonly error_description = input<string>();

  private readonly auth = inject(AuthStore);
  private readonly nav = inject(NavController);
  private readonly toasts = inject(ToastController);

  protected readonly failed = signal(false);

  async ngOnInit(): Promise<void> {
    const code = this.code();
    if (!code || this.error_description()) {
      this.failed.set(true);
      return;
    }
    try {
      await this.auth.exchangeCode(code);
      await this.nav.navigateRoot('/tabs/discover', { animationDirection: 'forward' });
      const toast = await this.toasts.create({ message: 'Email confirmé, bienvenue ! 🎉', color: 'success', duration: 2500, position: 'top' });
      await toast.present();
    } catch {
      // Typically: link opened in another browser than the one used to sign up (no PKCE verifier there).
      this.failed.set(true);
    }
  }
}
