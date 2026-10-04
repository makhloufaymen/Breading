import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  viewChild,
} from '@angular/core';
import { type GestureDetail, createGesture } from '@ionic/angular';

import { PetCardComponent, type PetCardData } from '../pet-card/pet-card.component';

export type SwipeDirection = 'like' | 'pass';

/** Share of the card width to drag before letting go swipes it away. */
const SWIPE_THRESHOLD = 0.3;
/** Or a quick flick (px/ms). */
const FLICK_VELOCITY = 0.4;
const FLY_OUT_MS = 320;
const SNAP_BACK_MS = 250;

/**
 * Tinder-like stack. Drag the top card right (like) or left (pass), or call
 * swipe() from buttons. Taps on the sides browse photos, in the middle open the card.
 *
 * Drag positions are written straight to the element's style (not through
 * signals): a pointer move 60 times per second must not trigger change detection.
 */
@Component({
  selector: 'app-swipe-deck',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="deck" #deck>
      @for (card of visible(); track card.id; let i = $index) {
        <div class="slot" [class.top]="i === 0" [attr.data-id]="card.id" [style.z-index]="2 - i" (click)="i === 0 && onTap($event, card)">
          <app-pet-card [card]="card" [photoIndex]="i === 0 ? photoIndex() : 0" />
          @if (i === 0) {
            <div class="stamp like" aria-hidden="true">J'aime 💛</div>
            <div class="stamp pass" aria-hidden="true">Non merci</div>
          }
        </div>
      }
    </div>
  `,
  styles: `
    :host { display: block; height: 100%; }
    .deck { position: relative; height: 100%; touch-action: none; }
    .slot {
      position: absolute;
      inset: 0;
      transform: translateY(14px) scale(0.94);
      transition: transform var(--app-duration-base) var(--app-ease-soft);
      will-change: transform;
    }
    .slot.top { transform: none; cursor: grab; }
    .stamp {
      position: absolute;
      top: var(--app-space-6);
      padding: var(--app-space-1) var(--app-space-3);
      border: 4px solid currentColor;
      border-radius: var(--app-radius-md);
      font-size: 1.6rem;
      font-weight: 900;
      text-transform: uppercase;
      opacity: 0;
      pointer-events: none;
    }
    .stamp.like { left: var(--app-space-5); color: var(--ion-color-success); transform: rotate(-14deg); }
    .stamp.pass { right: var(--app-space-5); color: var(--ion-color-danger); transform: rotate(14deg); }
  `,
  imports: [PetCardComponent],
})
export class SwipeDeckComponent {
  readonly cards = input.required<readonly PetCardData[]>();
  readonly swiped = output<{ id: string; direction: SwipeDirection }>();
  readonly opened = output<string>();

  /** Only the top card and the one behind it are rendered. */
  protected readonly visible = computed(() => this.cards().slice(0, 2));
  /** Back to the first photo whenever a new card reaches the top. */
  protected readonly photoIndex = linkedSignal({ source: () => this.cards()[0]?.id, computation: () => 0 });

  private readonly deck = viewChild.required<ElementRef<HTMLElement>>('deck');
  private animating = false;
  private dragged = false;

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const gesture = createGesture({
        el: this.deck().nativeElement,
        gestureName: 'pet-card-swipe',
        threshold: 0,
        onStart: () => (this.dragged = false),
        onMove: (detail) => this.onMove(detail),
        onEnd: (detail) => void this.onEnd(detail),
      });
      gesture.enable();
      destroyRef.onDestroy(() => gesture.destroy());
    });
  }

  /** Swipes the top card away programmatically (like/pass buttons). */
  async swipe(direction: SwipeDirection): Promise<void> {
    const top = this.topElement();
    if (!top || this.animating) return;
    this.setStamps(top, direction === 'like' ? 1 : -1);
    await this.flyOut(top, direction, 0);
  }

  protected onTap(event: MouseEvent, card: PetCardData): void {
    if (this.dragged || this.animating) return;
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const count = card.photoUrls.length;
    if (count > 1 && x < 0.3) {
      this.photoIndex.update((i) => Math.max(0, i - 1));
    } else if (count > 1 && x > 0.7) {
      this.photoIndex.update((i) => Math.min(count - 1, i + 1));
    } else {
      this.opened.emit(card.id);
    }
  }

  private onMove({ deltaX, deltaY }: GestureDetail): void {
    const top = this.topElement();
    if (!top || this.animating) return;
    if (Math.abs(deltaX) > 6 || Math.abs(deltaY) > 6) this.dragged = true;
    top.style.transition = 'none';
    top.style.transform = `translate(${deltaX}px, ${deltaY * 0.3}px) rotate(${deltaX * 0.05}deg)`;
    this.setStamps(top, deltaX / 120);
  }

  private async onEnd({ deltaX, deltaY, velocityX }: GestureDetail): Promise<void> {
    const top = this.topElement();
    if (!top || this.animating || !this.dragged) return;
    const width = top.offsetWidth || 1;
    const far = Math.abs(deltaX) > width * SWIPE_THRESHOLD;
    const flick = Math.abs(velocityX) > FLICK_VELOCITY && Math.sign(velocityX) === Math.sign(deltaX);
    if (far || flick) {
      await this.flyOut(top, deltaX > 0 ? 'like' : 'pass', deltaY * 0.3);
    } else {
      await this.snapBack(top);
    }
  }

  private async flyOut(top: HTMLElement, direction: SwipeDirection, y: number): Promise<void> {
    this.animating = true;
    const sign = direction === 'like' ? 1 : -1;
    const x = sign * (top.offsetWidth * 1.5 + 100);
    const animation = top.animate(
      [{ transform: top.style.transform || 'none' }, { transform: `translate(${x}px, ${y}px) rotate(${sign * 28}deg)` }],
      { duration: reducedMotion() ? 0 : FLY_OUT_MS, easing: 'ease-in', fill: 'forwards' },
    );
    await animation.finished;
    this.animating = false;
    // The parent removes the card; the next one slides to the top.
    const id = top.dataset['id'];
    if (id) this.swiped.emit({ id, direction });
  }

  private async snapBack(top: HTMLElement): Promise<void> {
    this.animating = true;
    const animation = top.animate([{ transform: top.style.transform }, { transform: 'none' }], {
      duration: reducedMotion() ? 0 : SNAP_BACK_MS,
      easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    });
    top.style.transform = '';
    this.setStamps(top, 0);
    await animation.finished;
    top.style.transition = '';
    this.animating = false;
  }

  /** ratio > 0 shows the like stamp, < 0 the pass stamp. */
  private setStamps(top: HTMLElement, ratio: number): void {
    const like = top.querySelector<HTMLElement>('.stamp.like');
    const pass = top.querySelector<HTMLElement>('.stamp.pass');
    if (like) like.style.opacity = String(Math.min(1, Math.max(0, ratio)));
    if (pass) pass.style.opacity = String(Math.min(1, Math.max(0, -ratio)));
  }

  private topElement(): HTMLElement | null {
    return this.deck().nativeElement.querySelector<HTMLElement>('.slot.top');
  }
}

function reducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
