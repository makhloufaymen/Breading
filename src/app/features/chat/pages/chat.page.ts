import { Component, afterRenderEffect, computed, inject, input, signal, untracked, viewChild } from '@angular/core';
import {
  ActionSheetController,
  AlertController,
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonSpinner,
  IonTextarea,
  IonToolbar,
  ModalController,
  NavController,
  ToastController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { alertCircle, ellipsisHorizontal, send } from 'ionicons/icons';

import { MESSAGE_MAX } from '../../../core/models/chat.models';
import { SPECIES_ID } from '../../../core/models/reference.models';
import { PetDetailModalComponent } from '../../../shared/ui/pet-detail/pet-detail.modal';
import { MatchesStore } from '../../matches/state/matches.store';
import { type ChatMessage, ConversationStore } from '../state/conversation.store';

type ChatItem =
  | { readonly kind: 'day'; readonly key: string; readonly label: string }
  | { readonly kind: 'message'; readonly key: string; readonly message: ChatMessage; readonly mine: boolean; readonly read: boolean };

const timeFormat = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });
const dayFormat = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
const matchDayFormat = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' });

const QUICK_REPLIES = ['Bonjour ! 🐾', 'Votre animal est adorable 😍', 'Quand seriez-vous disponible pour une rencontre ?'];

/** Conversation of one match (/tabs/matches/:matchId). */
@Component({
  selector: 'app-chat',
  templateUrl: './chat.page.html',
  styleUrl: './chat.page.scss',
  providers: [ConversationStore],
  imports: [
    IonHeader,
    IonToolbar,
    IonButtons,
    IonBackButton,
    IonButton,
    IonIcon,
    IonContent,
    IonFooter,
    IonTextarea,
    IonSpinner,
  ],
})
export class ChatPage {
  /** Route parameter (withComponentInputBinding). */
  readonly matchId = input.required<string>();

  protected readonly store = inject(ConversationStore);
  private readonly matches = inject(MatchesStore);
  private readonly actionSheets = inject(ActionSheetController);
  private readonly alerts = inject(AlertController);
  private readonly modals = inject(ModalController);
  private readonly toasts = inject(ToastController);
  private readonly nav = inject(NavController);

  private readonly content = viewChild(IonContent);

  protected readonly max = MESSAGE_MAX;
  protected readonly quickReplies = QUICK_REPLIES;
  protected readonly draft = signal('');
  protected readonly conversation = computed(() => this.matches.find(this.matchId()) ?? null);
  protected readonly otherPhoto = computed(() => {
    const path = this.conversation()?.other_pet_photo;
    return path ? this.matches.photoUrl(path) : null;
  });
  protected readonly otherEmoji = computed(() => (this.conversation()?.other_species_id === SPECIES_ID.cat ? '🐱' : '🐶'));
  protected readonly matchedOn = computed(() => {
    const at = this.conversation()?.matched_at;
    return at ? matchDayFormat.format(new Date(at)) : '';
  });

  /** Messages with a date separator whenever the day changes; "Lu" under my last read message. */
  protected readonly items = computed<ChatItem[]>(() => {
    const me = this.store.me();
    const messages = this.store.messages();
    const lastRead = [...messages].reverse().find((m) => m.sender_id === me && m.read_at)?.id;
    const items: ChatItem[] = [];
    let day = '';
    for (const message of messages) {
      const date = new Date(message.created_at);
      if (date.toDateString() !== day) {
        day = date.toDateString();
        items.push({ kind: 'day', key: `day-${day}`, label: dayLabel(date) });
      }
      items.push({ kind: 'message', key: message.id, message, mine: message.sender_id === me, read: message.id === lastRead });
    }
    return items;
  });

  constructor() {
    addIcons({ alertCircle, ellipsisHorizontal, send });
    // Follow the conversation: scroll down when a message is added at the end
    // (not when older messages are loaded at the top). After render, so the new
    // bubble is already in the page height.
    let lastId: string | undefined;
    afterRenderEffect(() => {
      const last = this.store.messages().at(-1)?.id;
      untracked(() => {
        if (last && last !== lastId) void this.content()?.scrollToBottom(lastId ? 250 : 0);
        lastId = last;
      });
    });
  }

  ionViewWillEnter(): void {
    const matchId = this.matchId();
    this.matches.setOpenConversation(matchId);
    if (!this.conversation()) void this.matches.load(); // opened directly (e.g. after a match)
    void this.store.open(matchId);
  }

  /** Pages stay alive in the router outlet: close the Realtime channel when leaving. */
  ionViewWillLeave(): void {
    this.store.close();
    this.matches.setOpenConversation(null);
  }

  protected time(message: ChatMessage): string {
    return timeFormat.format(new Date(message.created_at));
  }

  protected onInput(value: string | null | undefined): void {
    this.draft.set(value ?? '');
  }

  protected async sendDraft(): Promise<void> {
    const body = this.draft().trim();
    if (!body) return;
    this.draft.set('');
    await this.store.send(body);
  }

  protected useQuickReply(text: string): void {
    this.draft.set(text);
  }

  protected async openMenu(): Promise<void> {
    const conversation = this.conversation();
    if (!conversation) return;
    const sheet = await this.actionSheets.create({
      header: `${conversation.other_pet_name} · ${conversation.other_owner_name}`,
      buttons: [
        { text: `Voir la fiche de ${conversation.other_pet_name}`, handler: () => void this.openProfile() },
        { text: 'Annuler le match', role: 'destructive', handler: () => void this.confirmUnmatch() },
        { text: 'Fermer', role: 'cancel' },
      ],
    });
    await sheet.present();
  }

  protected async openProfile(): Promise<void> {
    const conversation = this.conversation();
    if (!conversation) return;
    const modal = await this.modals.create({
      component: PetDetailModalComponent,
      componentProps: { petId: conversation.other_pet_id, actions: false },
    });
    await modal.present();
  }

  private async confirmUnmatch(): Promise<void> {
    const conversation = this.conversation();
    if (!conversation) return;
    const alert = await this.alerts.create({
      header: `Annuler le match avec ${conversation.other_pet_name} ?`,
      message: 'La conversation sera supprimée et vos animaux ne vous seront plus proposés.',
      buttons: [
        { text: 'Garder', role: 'cancel' },
        { text: 'Annuler le match', role: 'destructive', handler: () => void this.unmatch(conversation.match_id) },
      ],
    });
    await alert.present();
  }

  private async unmatch(matchId: string): Promise<void> {
    try {
      await this.matches.unmatch(matchId);
      await this.nav.navigateBack('/tabs/matches');
    } catch {
      const toast = await this.toasts.create({ message: "L'annulation a échoué. Réessayez.", color: 'danger', duration: 2500, position: 'top' });
      await toast.present();
    }
  }
}

function dayLabel(date: Date): string {
  const today = new Date();
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Aujourd'hui";
  if (date.toDateString() === yesterday.toDateString()) return 'Hier';
  return dayFormat.format(date);
}
