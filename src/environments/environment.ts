// Development configuration: points to the local Supabase started with `supabase start`.
// The publishable key below is the fixed demo key of every local Supabase stack, not a secret.
export const environment = {
  production: false,
  supabase: {
    url: 'http://127.0.0.1:54321',
    publishableKey: 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH',
  },
};
