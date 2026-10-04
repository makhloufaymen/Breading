import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CanMatchFn, Route, Router, UrlSegment, UrlTree, provideRouter } from '@angular/router';

import { authGuard, guestGuard } from './auth.guards';
import { AuthStore } from './auth.store';

describe('auth guards', () => {
  const signedIn = signal(false);

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthStore, useValue: { isAuthenticated: computed(() => signedIn()) } },
      ],
    });
  });

  // The guards ignore their arguments; only the injected AuthStore matters.
  const run = (guard: typeof authGuard) =>
    TestBed.runInInjectionContext(() => guard({} as Route, [] as UrlSegment[], {} as Parameters<CanMatchFn>[2]));
  const url = (result: unknown) => TestBed.inject(Router).serializeUrl(result as UrlTree);

  it('authGuard lets a signed-in user through', () => {
    signedIn.set(true);
    expect(run(authGuard)).toBe(true);
  });

  it('authGuard sends a guest to /login', () => {
    signedIn.set(false);
    expect(url(run(authGuard))).toBe('/login');
  });

  it('guestGuard sends a signed-in user to the app', () => {
    signedIn.set(true);
    expect(url(run(guestGuard))).toBe('/tabs/discover');
  });

  it('guestGuard lets a guest through', () => {
    signedIn.set(false);
    expect(run(guestGuard)).toBe(true);
  });
});
