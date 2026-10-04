import { Injectable, computed, inject, signal } from '@angular/core';
import type { Subscription } from 'rxjs';

import { AuthStore } from '../../../core/auth/auth.store';
import { MessagesRepository } from '../../../core/messages/messages.repository';
import type { Message, MessageChange } from '../../../core/models/chat.models';

export type ChatMessage = Message & {
  /** pending: sent, not confirmed yet; failed: tap to retry. */
  readonly status: 'sent' | 'pending' | 'failed';
};

const PAGE_SIZE = 40;
/** Several messages arriving together: mark them read once. */
const READ_DELAY_MS = 400;

/**
 * One open conversation: history, live messages, sending, read receipts.
 * Provided by the chat page (one instance per screen), not in root.
 */
@Injectable()
export class ConversationStore {
  private readonly auth = inject(AuthStore);
  private readonly repository = inject(MessagesRepository);

  private readonly _messages = signal<ChatMessage[]>([]);
  private readonly _loading = signal(true);
  private readonly _error = signal(false);
  private readonly _hasMore = signal(false);
  private matchId: string | null = null;
  private live: Subscription | null = null;
  private readTimer: ReturnType<typeof setTimeout> | undefined;

  readonly messages = this._messages.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly hasMore = this._hasMore.asReadonly();
  readonly me = computed(() => this.auth.user()?.id ?? null);

  /** Starts listening first, then loads: a message sent in between is not missed (merge dedupes). */
  async open(matchId: string): Promise<void> {
    this.close();
    this.matchId = matchId;
    this._messages.set([]);
    this._loading.set(true);
    this._error.set(false);
    this.live = this.repository.changes(matchId).subscribe((change) => this.onChange(change));
    try {
      const page = await this.repository.list(matchId, PAGE_SIZE);
      this.merge(page.map(sent));
      this._hasMore.set(page.length === PAGE_SIZE);
      await this.repository.markRead(matchId);
    } catch {
      this._error.set(true);
    } finally {
      this._loading.set(false);
    }
  }

  /** Called when leaving the screen: closes the Realtime channel. */
  close(): void {
    this.live?.unsubscribe();
    this.live = null;
    clearTimeout(this.readTimer);
  }

  async loadOlder(): Promise<void> {
    const oldest = this._messages().find((m) => m.status === 'sent');
    if (!this.matchId || !oldest) return;
    const page = await this.repository.list(this.matchId, PAGE_SIZE, oldest.created_at);
    this.merge(page.map(sent));
    this._hasMore.set(page.length === PAGE_SIZE);
  }

  /** Shown at once as pending, confirmed by the server response (or the live stream, whichever comes first). */
  async send(body: string): Promise<void> {
    const me = this.me();
    if (!this.matchId || !me) return;
    const draft: ChatMessage = {
      id: `local-${crypto.randomUUID()}`,
      match_id: this.matchId,
      sender_id: me,
      body,
      created_at: new Date().toISOString(),
      read_at: null,
      status: 'pending',
    };
    this.merge([draft]);
    await this.deliver(draft);
  }

  async retry(localId: string): Promise<void> {
    const draft = this._messages().find((m) => m.id === localId && m.status === 'failed');
    if (!draft) return;
    this.replace(localId, { ...draft, status: 'pending' });
    await this.deliver(draft);
  }

  private async deliver(draft: ChatMessage): Promise<void> {
    try {
      const saved = await this.repository.send(draft.match_id, draft.body);
      this._messages.update((all) => all.filter((m) => m.id !== draft.id));
      this.merge([sent(saved)]);
    } catch {
      this.replace(draft.id, { ...draft, status: 'failed' });
    }
  }

  private onChange({ event, message }: MessageChange): void {
    if (event === 'UPDATE') {
      this.replace(message.id, sent(message)); // read receipt
      return;
    }
    this.merge([sent(message)]);
    if (message.sender_id !== this.me()) this.scheduleRead();
  }

  private scheduleRead(): void {
    clearTimeout(this.readTimer);
    this.readTimer = setTimeout(() => {
      if (this.matchId) void this.repository.markRead(this.matchId).catch(() => undefined);
    }, READ_DELAY_MS);
  }

  /** Adds messages not already there (same id), keeping the list in time order. */
  private merge(messages: ChatMessage[]): void {
    this._messages.update((all) => {
      const known = new Set(all.map((m) => m.id));
      const added = messages.filter((m) => !known.has(m.id));
      // Date.parse: server ("…+00:00", microseconds) and client ("…Z") formats differ.
      return added.length ? [...all, ...added].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at)) : all;
    });
  }

  private replace(id: string, message: ChatMessage): void {
    this._messages.update((all) => all.map((m) => (m.id === id ? message : m)));
  }
}

function sent(message: Message): ChatMessage {
  return { ...message, status: 'sent' };
}
