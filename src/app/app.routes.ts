import { Routes } from '@angular/router';

import { authGuard, guestGuard } from './core/auth/auth.guards';

export const routes: Routes = [
  {
    path: 'login',
    canMatch: [guestGuard],
    loadComponent: () => import('./features/auth/pages/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'register',
    canMatch: [guestGuard],
    loadComponent: () => import('./features/auth/pages/register.page').then((m) => m.RegisterPage),
  },
  {
    // Email confirmation link (no guard: it signs the user in).
    path: 'auth/callback',
    loadComponent: () => import('./features/auth/pages/auth-callback.page').then((m) => m.AuthCallbackPage),
  },
  {
    path: 'tabs',
    canMatch: [authGuard],
    loadComponent: () => import('./layout/tabs/tabs.page').then((m) => m.TabsPage),
    children: [
      {
        path: 'discover',
        loadComponent: () => import('./features/discover/pages/discover.page').then((m) => m.DiscoverPage),
      },
      {
        path: 'matches',
        children: [
          {
            path: '',
            loadComponent: () => import('./features/matches/pages/matches.page').then((m) => m.MatchesPage),
          },
          {
            // matchId is bound to the page's matchId input (withComponentInputBinding).
            path: ':matchId',
            loadComponent: () => import('./features/chat/pages/chat.page').then((m) => m.ChatPage),
          },
        ],
      },
      {
        path: 'pets',
        children: [
          {
            path: '',
            loadComponent: () => import('./features/pets/pages/my-pets.page').then((m) => m.MyPetsPage),
          },
          {
            path: 'new',
            loadComponent: () => import('./features/pets/pages/pet-form.page').then((m) => m.PetFormPage),
          },
          {
            // petId is bound to the page's petId input (withComponentInputBinding).
            path: ':petId',
            loadComponent: () => import('./features/pets/pages/pet-form.page').then((m) => m.PetFormPage),
          },
        ],
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
