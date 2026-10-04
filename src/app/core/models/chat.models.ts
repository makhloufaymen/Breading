import type { Database, Tables } from '../supabase/database.types';

export type Message = Tables<'messages'>;

/** Same bound as the CHECK constraint on messages.body. */
export const MESSAGE_MAX = 2000;

type ConversationRow = Database['public']['Functions']['my_conversations']['Returns'][number];

/** A match seen as a conversation (RPC my_conversations; the generator can't tell what is nullable). */
export type Conversation = Omit<
  ConversationRow,
  'my_pet_photo' | 'other_pet_photo' | 'last_message' | 'last_message_at' | 'last_message_mine'
> & {
  my_pet_photo: string | null;
  other_pet_photo: string | null;
  last_message: string | null;
  last_message_at: string | null;
  last_message_mine: boolean | null;
};

/** A realtime change on messages, as delivered by Supabase. */
export interface MessageChange {
  readonly event: 'INSERT' | 'UPDATE';
  readonly message: Message;
}
