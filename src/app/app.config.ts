import { ApplicationConfig, ErrorHandler, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { PreloadAllModules, RouteReuseStrategy, provideRouter, withComponentInputBinding, withPreloading } from '@angular/router';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular';

import { routes } from './app.routes';
import { AuthStore } from './core/auth/auth.store';
import { AppErrorHandler } from './core/errors/app-error-handler';
import { NetworkStore } from './core/network/network.store';
import { ThemeStore } from './core/theme/theme.store';

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    // Uncaught errors (including unhandled promise rejections) end up in AppErrorHandler.
    provideBrowserGlobalErrorListeners(),
    { provide: ErrorHandler, useClass: AppErrorHandler },
    // Same look on iOS and Android: force the iOS mode everywhere.
    // useSetInputAPI: modal/popover componentProps go through componentRef.setInput(),
    // which works with signal inputs (the default Object.assign overwrites them).
    provideIonicAngular({ mode: 'ios', useSetInputAPI: true }),
    provideRouter(routes, withPreloading(PreloadAllModules), withComponentInputBinding()),
    // Before the first screen renders: restore the light/dark choice and the
    // saved session (so guards know right away whether the user is signed in).
    provideAppInitializer(() => {
      const theme = inject(ThemeStore);
      const auth = inject(AuthStore);
      const network = inject(NetworkStore);
      return Promise.all([theme.load(), auth.init(), network.init()]);
    }),
  ],
};
