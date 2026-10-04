import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';

import { AuthStore } from './auth.store';

// The session is restored by the app initializer before the first navigation,
// so these guards can read the signal synchronously.

/** Only signed-in users; others are sent to the login screen. */
export const authGuard: CanMatchFn = () => {
  const auth = inject(AuthStore);
  return auth.isAuthenticated() || inject(Router).createUrlTree(['/login']);
};

/** Only signed-out users (login/register); others go straight to the app. */
export const guestGuard: CanMatchFn = () => {
  const auth = inject(AuthStore);
  return !auth.isAuthenticated() || inject(Router).createUrlTree(['/tabs/discover']);
};
