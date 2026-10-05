import { ErrorHandler, Injectable, inject } from '@angular/core';
import { ToastController } from '@ionic/angular';

import { NetworkStore } from '../network/network.store';

/** At most one toast per this delay: one failure often triggers several errors. */
const TOAST_INTERVAL_MS = 5000;

/**
 * Last line of defence for errors no screen handled (screens show their own
 * error states for expected failures). Logs, and tells the user something went
 * wrong instead of failing silently. Offline errors are already explained by the
 * offline banner.
 */
@Injectable()
export class AppErrorHandler implements ErrorHandler {
  private readonly toasts = inject(ToastController);
  private readonly network = inject(NetworkStore);
  private lastToast = 0;

  handleError(error: unknown): void {
    console.error(error);
    if (!this.network.online() || Date.now() - this.lastToast < TOAST_INTERVAL_MS) return;
    this.lastToast = Date.now();
    void this.toasts
      .create({ message: 'Oups, une erreur inattendue est survenue.', color: 'danger', duration: 3000, position: 'top' })
      .then((toast) => toast.present());
  }
}
