import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'tabs',
    loadComponent: () => import('./layout/tabs/tabs.page').then((m) => m.TabsPage),
    children: [
      {
        path: 'discover',
        loadComponent: () => import('./features/discover/pages/discover.page').then((m) => m.DiscoverPage),
      },
      {
        path: 'matches',
        loadComponent: () => import('./features/matches/pages/matches.page').then((m) => m.MatchesPage),
      },
      {
        path: 'pets',
        loadComponent: () => import('./features/pets/pages/my-pets.page').then((m) => m.MyPetsPage),
      },
      {
        path: 'account',
        loadComponent: () => import('./features/account/pages/account.page').then((m) => m.AccountPage),
      },
      { path: '', redirectTo: 'discover', pathMatch: 'full' },
    ],
  },
  { path: '', redirectTo: 'tabs/discover', pathMatch: 'full' },
  { path: '**', redirectTo: 'tabs/discover' },
];
