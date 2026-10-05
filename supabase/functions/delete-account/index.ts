// Deletes the caller's account: Storage photos, then the auth user. Deleting the
// auth user cascades through the database (profile → pets → photos rows,
// vaccinations, swipes, matches → messages; blocks; reports keep a null author).
//
// Why an Edge Function: deleting an auth user needs the service_role key, which
// must never ship in the app. The function runs on Supabase's servers, checks
// who is calling from the user's JWT, and only then uses the service_role key,
// for that user's data only.
import { createClient } from 'npm:@supabase/supabase-js@2';

const BUCKET = 'pet-photos';

// The app calls this from the browser (ionic serve) and from the WebView.
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'unauthorized' }, 401);

  // Provided by Supabase to every function (locally and in production).
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Who is calling: the user id comes from the verified JWT, never from the request body.
  const { data: auth, error: authError } = await admin.auth.getUser(token);
  if (authError || !auth.user) return json({ error: 'unauthorized' }, 401);
  const userId = auth.user.id;

  // 1. Photos: {userId}/{petId}/{file}. Storage files are not removed by SQL cascades.
  const storage = admin.storage.from(BUCKET);
  const { data: petFolders, error: listError } = await storage.list(userId, { limit: 1000 });
  if (listError) return json({ error: 'storage_list_failed' }, 500);
  const paths: string[] = [];
  for (const folder of petFolders ?? []) {
    const { data: files, error } = await storage.list(`${userId}/${folder.name}`, { limit: 1000 });
    if (error) return json({ error: 'storage_list_failed' }, 500);
    paths.push(...(files ?? []).map((file) => `${userId}/${folder.name}/${file.name}`));
  }
  if (paths.length) {
    const { error } = await storage.remove(paths);
    if (error) return json({ error: 'storage_remove_failed' }, 500);
  }

  // 2. The account itself (cascades to all the user's rows).
  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (deleteError) return json({ error: 'delete_failed' }, 500);

  return json({ deleted: true, photos: paths.length });
});
