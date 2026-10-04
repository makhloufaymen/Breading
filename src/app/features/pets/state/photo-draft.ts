/**
 * A photo in the pet form. Changes stay local until "Enregistrer": new photos
 * are uploaded, removed ones deleted and the order saved in one go.
 */
export type PhotoDraft =
  | { readonly kind: 'stored'; readonly key: string; readonly id: string; readonly path: string; readonly url: string }
  /** url is an object URL of the processed blob (revoke it when done). */
  | { readonly kind: 'new'; readonly key: string; readonly blob: Blob; readonly url: string };

export type StoredPhotoDraft = Extract<PhotoDraft, { kind: 'stored' }>;

export interface PhotoChanges {
  /** Final order; the first one is the main photo. */
  readonly items: readonly PhotoDraft[];
  readonly removed: readonly StoredPhotoDraft[];
}

/** Moves the item at `from` to index `to`, returning a new array. */
export function movePhoto<T>(items: readonly T[], from: number, to: number): T[] {
  const result = [...items];
  const [item] = result.splice(from, 1);
  result.splice(to, 0, item);
  return result;
}

/** Thrown when the pet was saved but some photo operations failed. */
export class PhotoSyncError extends Error {
  constructor(
    readonly petId: string,
    cause: unknown,
  ) {
    super('Pet saved, but photos could not all be synced', { cause });
  }
}
