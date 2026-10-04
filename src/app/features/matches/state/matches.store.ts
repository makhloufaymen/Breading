import { DestroyRef, Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import type { Subscription } from 'rxjs';

import { AuthStore } from '../../../core/auth/auth.store';
import { MessagesRepository } from '../../../core/messages/messages.repository';
import type { Conversation, MessageChange } from '../../../core/models/chat.models';
import type { ReceivedLike } from '../../../core/models/match.models';
import { PhotosRepository } from '../../../core/photos/photos.repository';
import { type SwipeKind, SwipesRepository } from '../../../core/swipes/swipes.repository';
import { MatchesRepository } from '../data/matches.repository';

/**
 * My matches (as conversations) and the likes my pets received.
 * While signed in, listens to new messages to keep last messages and unread
 * counters (tab badge) up to date. Cleared on sign-out.
 */
@Injectable({ providedIn: 'root' })
export class MatchesStore {
  private readonly auth = inject(AuthStore);
  private readonly repository = inject(MatchesRepository);
  private readonly messages = inject(MessagesRepository);
  private readonly swipes = inject(SwipesRepository);
  private readonly photos = inject(PhotosRepository);

  private readonly _matches = signal<Conversation[]>([]);
  private readonly _likes = signal<ReceivedLike[]>([]);
  private readonly _loaded = signal(false);
  private readonly _error = signal(false);
  /** Conversation on screen: its incoming messages are read, not counted. */
  private openMatchId: string | null = null;
  private inbox: Subscription | null = null;

  readonly matches = this._matches.asReadonly();
  readonly likes = this._likes.asReadonly();
  readonly loaded = this._loaded.asReadonly();
  readonly error = this._error.asReadonly();
  readonly likesCount = computed(() => this._likes().length);
  readonly unreadTotal = computed(() => this._matches().reduce((sum, m) => sum + m.unread_count, 0));

  constructor() {
    effect(() => {
      const userId = this.auth.user()?.id;
      untracked(() => {
        this.inbox?.unsubscribe();
        this.inbox = null;
        if (userId) {
          this.inbox = this.messages.changes().subscribe((change) => this.onMessage(change, userId));
          void this.load();
        } else {
          this._matches.set([]);
          this._likes.set([]);
          this._loaded.set(false);
        }
      });
    });
    inject(DestroyRef).onDestroy(() => this.inbox?.unsubscribe());
  }

  photoUrl(path: string): string {
    return this.photos.publicUrl(path);
  }

  find(matchId: string): Conversation | undefined {
    return this._matches().find((m) => m.match_id === matchId);
  }

  async load(): Promise<void> {
    if (!this.auth.user()) return;
    this._error.set(false);
    try {
      const [matches, likes] = await Promise.all([this.repository.conversations(), this.repository.receivedLikes()]);
      this._matches.set(matches.map((m) => (m.match_id === this.openMatchId ? { ...m, unread_count: 0 } : m)));
      this._likes.set(likes);
      this._loaded.set(true);
    } catch {
      this._error.set(true);
    }
  }

  /** Called by the chat screen on enter (id) and leave (null). */
  setOpenConversation(matchId: string | null): void {
    this.openMatchId = matchId;
    if (matchId) this.update(matchId, (m) => ({ ...m, unread_count: 0 }));
  }

  async unmatch(matchId: string): Promise<void> {
    await this.repository.unmatch(matchId);
    this._matches.update((matches) => matches.filter((m) => m.match_id !== matchId));
  }

  /**
   * Answers a like received, on behalf of the liked pet. Returns the match id
   * when liking back (always a match, unless the other pet became incompatible).
   */
  async answerLike(like: ReceivedLike, kind: SwipeKind): Promise<string | null> {
    const matchId = await this.swipes.swipe(like.my_pet_id, like.id, kind);
    this._likes.update((likes) => likes.filter((l) => !(l.id === like.id && l.my_pet_id === like.my_pet_id)));
    if (matchId) await this.load();
    return matchId;
  }

  private onMessage({ event, message }: MessageChange, userId: string): void {
    if (event !== 'INSERT') return;
    if (!this.find(message.match_id)) {
      void this.load(); // a match created meanwhile (by the other owner liking back)
      return;
    }
    const mine = message.sender_id === userId;
    this.update(message.match_id, (m) => ({
      ...m,
      last_message: message.body,
      last_message_at: message.created_at,
      last_message_mine: mine,
      unread_count: mine || message.match_id === this.openMatchId ? m.unread_count : m.unread_count + 1,
    }));
    // Most recent activity first.
    this._matches.update((matches) => [
      ...matches.filter((m) => m.match_id === message.match_id),
      ...matches.filter((m) => m.match_id !== message.match_id),
    ]);
  }

  private update(matchId: string, change: (m: Conversation) => Conversation): void {
    this._matches.update((matches) => matches.map((m) => (m.match_id === matchId ? change(m) : m)));
  }
}
