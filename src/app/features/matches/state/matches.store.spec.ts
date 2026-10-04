import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';

import { AuthStore } from '../../../core/auth/auth.store';
import { MessagesRepository } from '../../../core/messages/messages.repository';
import type { Conversation, Message, MessageChange } from '../../../core/models/chat.models';
import type { ReceivedLike } from '../../../core/models/match.models';
import { PhotosRepository } from '../../../core/photos/photos.repository';
import { SwipesRepository } from '../../../core/swipes/swipes.repository';
import { MatchesRepository } from '../data/matches.repository';
import { MatchesStore } from './matches.store';

const conversation = (id: string, unread = 0) => ({ match_id: id, unread_count: unread, last_message: null }) as Conversation;
const message = (matchId: string, senderId: string, body = 'Coucou') =>
  ({ id: crypto.randomUUID(), match_id: matchId, sender_id: senderId, body, created_at: new Date().toISOString() }) as Message;

describe('MatchesStore', () => {
  let live: Subject<MessageChange>;
  let conversations: Conversation[];
  let likes: ReceivedLike[];
  let swipeResult: string | null;

  beforeEach(() => {
    live = new Subject();
    conversations = [conversation('m1'), conversation('m2', 2)];
    likes = [{ id: 'liker', my_pet_id: 'rex' } as ReceivedLike];
    swipeResult = null;
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthStore, useValue: { user: signal({ id: 'me' }) } },
        { provide: PhotosRepository, useValue: {} },
        { provide: MessagesRepository, useValue: { changes: () => live } },
        { provide: SwipesRepository, useValue: { swipe: async () => swipeResult } },
        {
          provide: MatchesRepository,
          useValue: { conversations: async () => conversations, receivedLikes: async () => likes },
        },
      ],
    });
  });

  async function loadedStore(): Promise<MatchesStore> {
    const store = TestBed.inject(MatchesStore);
    TestBed.tick(); // runs the sign-in effect (subscribes, loads)
    await store.load();
    return store;
  }

  it('counts unread messages across conversations', async () => {
    const store = await loadedStore();
    expect(store.unreadTotal()).toBe(2);
  });

  it('a message received moves the conversation up and counts as unread', async () => {
    const store = await loadedStore();
    live.next({ event: 'INSERT', message: message('m2', 'other', 'Salut') });
    expect(store.matches()[0].match_id).toBe('m2');
    expect(store.matches()[0].last_message).toBe('Salut');
    expect(store.unreadTotal()).toBe(3);
  });

  it('my own messages and the open conversation do not count as unread', async () => {
    const store = await loadedStore();
    live.next({ event: 'INSERT', message: message('m1', 'me') });
    store.setOpenConversation('m2');
    live.next({ event: 'INSERT', message: message('m2', 'other') });
    expect(store.unreadTotal()).toBe(0);
    expect(store.find('m1')?.last_message_mine).toBe(true);
  });

  it('removes an answered like and reports the match', async () => {
    const store = await loadedStore();
    const like = store.likes()[0];
    likes = [];
    swipeResult = 'm3';
    expect(await store.answerLike(like, 'like')).toBe('m3');
    expect(store.likesCount()).toBe(0);
  });
});
