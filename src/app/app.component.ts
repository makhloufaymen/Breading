import { Component, effect, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonApp, IonRouterOutlet, NavController } from '@ionic/angular';

import { AuthStore } from './core/auth/auth.store';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent {
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly nav = inject(NavController);

  constructor() {
    // If the session disappears while inside the app (sign-out, expired refresh
    // token, account deleted), go back to the login screen with a fresh stack.
    effect(() => {
      if (this.auth.initialized() && !this.auth.isAuthenticated() && this.router.url.startsWith('/tabs')) {
        void this.nav.navigateRoot('/login', { animationDirection: 'back' });
      }
    });
  }
}
