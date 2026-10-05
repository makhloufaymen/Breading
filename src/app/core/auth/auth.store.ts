import { Injectable, computed, inject, signal } from '@angular/core';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import type { Session } from '@supabase/supabase-js';

import { SUPABASE } from '../supabase/supabase.client';

/** Where the confirmation email link leads: the app itself (deep link) or this site. */
export function authCallbackUrl(): string {
  return Capacitor.isNativePlatform() ? 'com.breading.app://auth/callback' : `${window.location.origin}/auth/callback`;
}

export interface SignUpData {
  readonly displayName: string;
  readonly email: string;
  readonly password: string;
}

/**
 * Source of truth for "who is signed in". Supabase persists the session itself
 * (see capacitor-storage.ts); this store mirrors it into signals for the UI.
 */
@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly supabase = inject(SUPABASE);

  private readonly _session = signal<Session | null>(null);
  private readonly _initialized = signal(false);

  readonly session = this._session.asReadonly();
  readonly initialized = this._initialized.asReadonly();
  readonly user = computed(() => this._session()?.user ?? null);
  readonly isAuthenticated = computed(() => this._session() !== null);

  /** Called once at startup (app initializer): restores the saved session. */
  async init(): Promise<void> {
    const { data } = await this.supabase.auth.getSession();
    this._session.set(data.session);
    this._initialized.set(true);

    // Fires on sign-in, sign-out, token refresh and session expiry.
    this.supabase.auth.onAuthStateChange((_event, session) => this._session.set(session));

    // Mobile apps are suspended in the background: pause token refresh then,
    // and refresh right away when the user comes back.
    if (Capacitor.isNativePlatform()) {
      await App.addListener('appStateChange', ({ isActive }) => {
        if (isActive) {
          void this.supabase.auth.startAutoRefresh();
        } else {
          void this.supabase.auth.stopAutoRefresh();
        }
      });
    }
  }

  /** Returns true when the email must be confirmed first (no session yet). */
  async signUp({ displayName, email, password }: SignUpData): Promise<{ confirmationRequired: boolean }> {
    const { data, error } = await this.supabase.auth.signUp({
      email,
      password,
      options: {
        // Read by the handle_new_user trigger to fill profiles.display_name.
        data: { display_name: displayName },
        emailRedirectTo: authCallbackUrl(),
      },
    });
    if (error) throw error;
    return { confirmationRequired: !data.session };
  }

  async resendConfirmation(email: string): Promise<void> {
    const { error } = await this.supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: authCallbackUrl() } });
    if (error) throw error;
  }

  /** Second half of the confirmation link: the one-time code becomes a session. */
  async exchangeCode(code: string): Promise<void> {
    const { error } = await this.supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
  }

  async signIn(email: string, password: string): Promise<void> {
    const { error } = await this.supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async signOut(): Promise<void> {
    // 'local' only ends this device's session; other devices stay signed in.
    const { error } = await this.supabase.auth.signOut({ scope: 'local' });
    if (error) throw error;
  }
}
