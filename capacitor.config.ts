import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Set by scripts/build-android.mjs for a release build against a hosted (https)
 * Supabase: the development-only network flags below are then left out.
 */
const release = process.env['BREADING_RELEASE'] === '1';

const config: CapacitorConfig = {
  appId: 'com.breading.app',
  appName: 'Breading',
  webDir: 'www',
  // DEV ONLY: the local Supabase is plain HTTP (http://10.0.2.2:54321 from the
  // emulator) while the app itself is served from https://localhost. Android
  // blocks that by default, so these flags allow it outside release builds.
  ...(release ? {} : { server: { cleartext: true }, android: { allowMixedContent: true } }),
  plugins: {
    SplashScreen: {
      // Hidden by AppComponent as soon as the first screen is drawn; 3 s is only a fallback.
      launchShowDuration: 3000,
      launchAutoHide: true,
      backgroundColor: '#fff9f3',
      showSpinner: false,
    },
  },
};

export default config;
