import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.breading.app',
  appName: 'Breading',
  webDir: 'www',
  // DEV ONLY: the local Supabase is plain HTTP (http://10.0.2.2:54321 from the
  // emulator) while the app itself is served from https://localhost. Android
  // blocks that by default. Remove both flags before the release build (step 9).
  server: {
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;
