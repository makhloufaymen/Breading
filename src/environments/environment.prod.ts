// Production configuration. No hosted Supabase project yet: until step 9 this
// still points to the local stack so release builds can be tried on the emulator.
export const environment = {
  production: true,
  supabase: {
    url: 'http://127.0.0.1:54321',
    publishableKey: 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH',
  },
};
