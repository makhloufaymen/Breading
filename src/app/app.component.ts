import { Component, afterNextRender, effect, inject } from '@angular/core';
import { Router } from '@angular/router';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import { IonApp, IonRouterOutlet, NavController } from '@ionic/angular';

import { AuthStore } from './core/auth/auth.store';
import { NetworkStore } from './core/network/network.store';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrl: 'app.component.scss',
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent {
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly nav = inject(NavController);
  protected readonly network = inject(NetworkStore);

  constructor() {
    // The native splash stays until the first screen is drawn (auto-hide after 3 s as a fallback).
    afterNextRender(() => void SplashScreen.hide({ fadeOutDuration: 300 }).catch(() => undefined));

    // If the session disappears while inside the app (sign-out, expired refresh
    // token, account deleted), go back to the login screen with a fresh stack.
    effect(() => {
      if (this.auth.initialized() && !this.auth.isAuthenticated() && this.router.url.startsWith('/tabs')) {
        void this.nav.navigateRoot('/login', { animationDirection: 'back' });
      }
    });

    // Deep link: the confirmation email opens com.breading.app://auth/callback?code=…
    // Android/iOS hand it to the app (intent filter / URL scheme), which shows the callback page.
    if (Capacitor.isNativePlatform()) {
      void App.addListener('appUrlOpen', ({ url }) => {
        const link = new URL(url);
        if (link.host === 'auth' && link.pathname === '/callback') {
          void this.nav.navigateRoot('/auth/callback' + link.search);
        }
      });
    }
  }
}
