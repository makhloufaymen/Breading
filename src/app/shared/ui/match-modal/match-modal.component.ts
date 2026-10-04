import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { IonButton, IonContent, ModalController } from '@ionic/angular';

export interface MatchPetView {
  readonly name: string;
  readonly photoUrl: string | null;
  readonly emoji: string;
}

const CONFETTI = ['🐾', '💛', '🦴', '✨', '💕', '🐾', '🌸', '💛', '✨', '🦴', '💕', '🐾'];

/** "C'est un match !" celebration. Dismisses with role 'message' or 'continue'. */
@Component({
  selector: 'app-match-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-content [scrollY]="false">
      <div class="screen">
        <div class="confetti" aria-hidden="true">
          @for (piece of confetti; track $index) {
            <span [style.left.%]="piece.left" [style.animation-delay.ms]="piece.delay" [style.font-size.px]="piece.size">{{
              piece.emoji
            }}</span>
          }
        </div>

        <h1>C'est un match !</h1>
        <p>{{ mine().name }} et {{ other().name }} se plaisent mutuellement.</p>

        <div class="pair">
          @for (pet of [mine(), other()]; track $index) {
            <div class="photo" [class.right]="$index === 1">
              @if (pet.photoUrl) {
                <img [src]="pet.photoUrl" alt="" />
              } @else {
                <span aria-hidden="true">{{ pet.emoji }}</span>
              }
            </div>
          }
          <div class="heart" aria-hidden="true">💛</div>
        </div>

        <div class="buttons">
          <ion-button expand="block" (click)="close('message')">Envoyer un message</ion-button>
          <ion-button expand="block" fill="clear" (click)="close('continue')">Continuer à découvrir</ion-button>
        </div>
      </div>
    </ion-content>
  `,
  styles: `
    ion-content {
      --background: linear-gradient(160deg, var(--ion-color-primary), var(--ion-color-tertiary));
    }
    .screen {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      padding: var(--app-space-6) var(--app-space-5);
      text-align: center;
      color: var(--ion-color-primary-contrast);
      overflow: hidden;
    }
    h1 {
      margin: 0;
      font-size: 2.4rem;
      font-weight: 900;
      animation: pop var(--app-duration-slow) var(--app-ease-bounce) both;
    }
    p { margin: var(--app-space-2) 0 0; font-weight: 700; animation: app-fade-up var(--app-duration-slow) var(--app-ease-soft) 150ms both; }
    .pair { position: relative; display: flex; margin: var(--app-space-6) 0; }
    .photo {
      display: grid;
      place-items: center;
      width: 132px;
      height: 132px;
      overflow: hidden;
      border: 5px solid var(--app-surface);
      border-radius: 50%;
      background: var(--app-surface-muted);
      box-shadow: var(--app-shadow-lifted);
      font-size: 64px;
      transform: rotate(-8deg);
      animation: slide-left var(--app-duration-slow) var(--app-ease-bounce) 200ms both;
    }
    .photo.right { margin-left: -24px; transform: rotate(8deg); animation-name: slide-right; }
    .photo img { width: 100%; height: 100%; object-fit: cover; }
    .heart {
      position: absolute;
      left: 50%;
      bottom: -18px;
      font-size: 48px;
      transform: translateX(-50%);
      animation: beat 1.2s ease-in-out 800ms infinite;
    }
    .buttons { width: 100%; max-width: 320px; animation: app-fade-up var(--app-duration-slow) var(--app-ease-soft) 500ms both; }
    .buttons ion-button[fill='clear'] { --color: var(--ion-color-primary-contrast); }
    .confetti span {
      position: absolute;
      top: -40px;
      animation: fall 3.2s linear both;
    }
    @keyframes pop { from { opacity: 0; transform: scale(0.4); } to { opacity: 1; transform: scale(1); } }
    @keyframes slide-left { from { opacity: 0; transform: translateX(-80px) rotate(-30deg); } to { opacity: 1; transform: rotate(-8deg); } }
    @keyframes slide-right { from { opacity: 0; transform: translateX(80px) rotate(30deg); } to { opacity: 1; transform: rotate(8deg); } }
    @keyframes beat { 0%, 100% { transform: translateX(-50%) scale(1); } 50% { transform: translateX(-50%) scale(1.2); } }
    @keyframes fall { to { transform: translateY(110vh) rotate(360deg); opacity: 0.2; } }
  `,
  imports: [IonContent, IonButton],
})
export class MatchModalComponent {
  /** Passed through ModalController componentProps. */
  readonly mine = input.required<MatchPetView>();
  readonly other = input.required<MatchPetView>();

  // Not named "modal": Ionic writes the <ion-modal> element into that property.
  private readonly modals = inject(ModalController);

  protected readonly confetti = CONFETTI.map((emoji, i) => ({
    emoji,
    left: (i * 83) % 100,
    delay: (i * 260) % 1500,
    size: 20 + ((i * 7) % 18),
  }));

  protected close(role: 'message' | 'continue'): void {
    void this.modals.dismiss(null, role);
  }
}
