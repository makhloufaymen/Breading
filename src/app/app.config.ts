import { ApplicationConfig, inject, provideAppInitializer } from '@angular/core';
import { PreloadAllModules, RouteReuseStrategy, provideRouter, withComponentInputBinding, withPreloading } from '@angular/router';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular';

import { routes } from './app.routes';
import { ThemeStore } from './core/theme/theme.store';

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    // Same look on iOS and Android: force the iOS mode everywhere.
    provideIonicAngular({ mode: 'ios' }),
    provideRouter(routes, withPreloading(PreloadAllModules), withComponentInputBinding()),
    // Restore the saved light/dark choice before the first screen renders.
    provideAppInitializer(() => inject(ThemeStore).load()),
  ],
};
