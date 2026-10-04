// Development only: gives the seed.sql test pets real photos.
// Downloads random dog/cat pictures from free public APIs (dog.ceo, thecatapi)
// and stores them like the app does: Storage file + pet_photos row.
// Each test pet (ids 5eed…) gets 1 to 3 photos; missing ones are added. Safe to run again.
//
// Usage (Supabase running): node supabase/scripts/seed-photos.mjs

import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

const API = 'http://127.0.0.1:54321';
const MAX_BYTES = 2 * 1024 * 1024; // bucket limit
const PARALLEL = 6;

/** The local service key bypasses RLS: never use it in the app. */
function serviceKey() {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) return process.env.SUPABASE_SERVICE_ROLE_KEY;
  const env = execSync('supabase status -o env', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  const line = env.split('\n').find((l) => /^(SERVICE_ROLE_KEY|SECRET_KEY)=/.test(l));
  if (!line) throw new Error('Service key not found: is Supabase running?');
  return line.slice(line.indexOf('=') + 1).replace(/"/g, '').trim();
}

const key = serviceKey();
const headers = { apikey: key, Authorization: `Bearer ${key}` };

async function api(path, init = {}) {
  const response = await fetch(`${API}${path}`, { ...init, headers: { ...headers, ...init.headers } });
  if (!response.ok) throw new Error(`${init.method ?? 'GET'} ${path}: ${response.status} ${await response.text()}`);
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function randomImageUrl(speciesId) {
  if (speciesId === 1) {
    const { message } = await (await fetch('https://dog.ceo/api/breeds/image/random')).json();
    return message;
  }
  const [cat] = await (await fetch('https://api.thecatapi.com/v1/images/search?mime_types=jpg')).json();
  return cat.url;
}

/** A JPEG under the bucket limit (retries on PNG/GIF or too big files). */
async function downloadJpeg(speciesId) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const response = await fetch(await randomImageUrl(speciesId));
    const type = response.headers.get('content-type') ?? '';
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (response.ok && type.includes('jpeg') && bytes.length < MAX_BYTES) return bytes;
  }
  throw new Error('no suitable JPEG after several attempts');
}

async function addPhotos(pet, from, count) {
  for (let position = from; position < count; position++) {
    const jpeg = await downloadJpeg(pet.species_id);
    const path = `${pet.owner_id}/${pet.id}/${randomUUID()}.jpg`;
    await api(`/storage/v1/object/pet-photos/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'image/jpeg' },
      body: jpeg,
    });
    await api('/rest/v1/pet_photos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ pet_id: pet.id, path, position }),
    });
  }
}

const queue = (await api('/rest/v1/pets?select=id,owner_id,species_id,pet_photos(id)&order=id'))
  .filter((p) => p.id.startsWith('5eed'))
  .map((pet, index) => ({ pet, from: pet.pet_photos.length, count: 1 + (index % 3) })) // 1 to 3 photos each
  .filter((item) => item.from < item.count);
const total = queue.length;

console.log(`${total} test pets need photos`);
let done = 0;
let failed = 0;

await Promise.all(
  Array.from({ length: PARALLEL }, async () => {
    for (let item = queue.shift(); item; item = queue.shift()) {
      try {
        await addPhotos(item.pet, item.from, item.count);
        done++;
      } catch (error) {
        failed++;
        console.error(`  ${item.pet.id}: ${error.message}`);
      }
      if ((done + failed) % 10 === 0) console.log(`  ${done + failed}/${total}`);
    }
  }),
);
console.log(`Done: ${done} pets with photos, ${failed} failed.`);
