import { InjectionToken } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { SupabaseClient, createClient } from '@supabase/supabase-js';

import { environment } from '../../../environments/environment';
import { capacitorStorage } from './capacitor-storage';
import type { Database } from './database.types';

export type AppSupabaseClient = SupabaseClient<Database>;

/**
 * Inside the Android emulator, 127.0.0.1 is the emulator itself; the host PC
 * (where the local Supabase runs) is reachable at 10.0.2.2.
 */
function resolveUrl(url: string): string {
  if (Capacitor.getPlatform() === 'android') {
    return url.replace('127.0.0.1', '10.0.2.2').replace('localhost', '10.0.2.2');
  }
  return url;
}

/**
 * The single Supabase client of the app. Only repositories (features/x/data)
 * and core stores should inject it.
 */
export const SUPABASE = new InjectionToken<AppSupabaseClient>('SUPABASE', {
  providedIn: 'root',
  factory: () =>
    createClient<Database>(resolveUrl(environment.supabase.url), environment.supabase.publishableKey, {
      auth: {
        storage: capacitorStorage,
        persistSession: true,
        autoRefreshToken: true,
        // No OAuth/magic-link redirects into the app yet (deep links come in step 8).
        detectSessionInUrl: false,
      },
    }),
});
