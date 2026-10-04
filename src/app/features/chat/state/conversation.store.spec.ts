import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';

import { AuthStore } from '../../../core/auth/auth.store';
import { MessagesRepository } from '../../../core/messages/messages.repository';
import type { Message, MessageChange } from '../../../core/models/chat.models';
import { ConversationStore } from './conversation.store';

const message = (id: string, senderId: string, minute: number, readAt: string | null = null): Message => ({
  id,
  match_id: 'm1',
  sender_id: senderId,
  body: id,
  created_at: `2026-10-04T10:${String(minute).padStart(2, '0')}:00.000000+00:00`,
  read_at: readAt,
});

describe('ConversationStore', () => {
  let live: Subject<MessageChange>;
  let sendResult: () => Promise<Message>;
  let markReadCalls: number;

  beforeEach(() => {
    live = new Subject();
    markReadCalls = 0;
    sendResult = async () => message('server-1', 'me', 30);
    TestBed.configureTestingModule({
      providers: [
        ConversationStore,
        { provide: AuthStore, useValue: { user: signal({ id: 'me' }) } },
        {
          provide: MessagesRepository,
          useValue: {
            changes: () => live,
            list: async () => [message('a', 'other', 1), message('b', 'me', 2)],
            send: () => sendResult(),
            markRead: async () => void markReadCalls++,
          },
        },
      ],
    });
  });

  it('loads the history and marks it read', async () => {
    const store = TestBed.inject(ConversationStore);
    await store.open('m1');
    expect(store.messages().map((m) => m.id)).toEqual(['a', 'b']);
    expect(markReadCalls).toBe(1);
  });

  it('shows a sent message at once, then replaces it with the saved one', async () => {
    const store = TestBed.inject(ConversationStore);
    await store.open('m1');
    const sending = store.send('Hello');
    expect(store.messages().at(-1)?.status).toBe('pending');
    await sending;
    expect(store.messages().map((m) => m.id)).toEqual(['a', 'b', 'server-1']);
  });

  it('does not duplicate a message received both live and as the send response', async () => {
    const store = TestBed.inject(ConversationStore);
    await store.open('m1');
    sendResult = async () => {
      live.next({ event: 'INSERT', message: message('server-1', 'me', 30) }); // live event first
      return message('server-1', 'me', 30);
    };
    await store.send('Hello');
    expect(store.messages().filter((m) => m.id === 'server-1')).toHaveLength(1);
  });

  it('keeps a failed message to retry', async () => {
    const store = TestBed.inject(ConversationStore);
    await store.open('m1');
    sendResult = async () => {
      throw new Error('offline');
    };
    await store.send('Hello');
    const failed = store.messages().at(-1)!;
    expect(failed.status).toBe('failed');
    sendResult = async () => message('server-2', 'me', 31);
    await store.retry(failed.id);
    expect(store.messages().at(-1)?.id).toBe('server-2');
  });

  it('applies read receipts', async () => {
    const store = TestBed.inject(ConversationStore);
    await store.open('m1');
    live.next({ event: 'UPDATE', message: message('b', 'me', 2, '2026-10-04T10:05:00Z') });
    expect(store.messages().find((m) => m.id === 'b')?.read_at).not.toBeNull();
  });
});
