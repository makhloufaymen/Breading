import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** What a card shows; built by the page from its own data (no store here). */
export interface PetCardData {
  readonly id: string;
  readonly name: string;
  readonly sex: 'male' | 'female';
  readonly age: string;
  readonly breed: string;
  readonly place: string;
  readonly pedigree: boolean;
  readonly photoUrls: readonly string[];
  /** Shown instead of a photo when there is none. */
  readonly emoji: string;
}

/** Full-bleed photo card with the essentials over a soft scrim. */
@Component({
  selector: 'app-pet-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="card">
      @if (card().photoUrls.length) {
        <img [src]="card().photoUrls[photoIndex()]" alt="" draggable="false" />
        @if (card().photoUrls.length > 1) {
          <div class="bars" aria-hidden="true">
            @for (url of card().photoUrls; track $index) {
              <span [class.on]="$index === photoIndex()"></span>
            }
          </div>
        }
      } @else {
        <div class="no-photo" aria-hidden="true">{{ card().emoji }}</div>
      }
      <div class="info">
        <h2>
          {{ card().name }}<span class="age">, {{ card().age }}</span>
          <span class="sex" [attr.aria-label]="card().sex === 'male' ? 'mâle' : 'femelle'">{{ card().sex === 'male' ? '♂' : '♀' }}</span>
        </h2>
        <p>{{ card().breed }}</p>
        <p class="place">📍 {{ card().place }}</p>
        @if (card().pedigree) {
          <span class="badge">🏅 Pedigree</span>
        }
      </div>
    </article>
  `,
  styles: `
    :host { display: block; height: 100%; }
    .card {
      position: relative;
      height: 100%;
      overflow: hidden;
      border-radius: var(--app-radius-xl);
      background: linear-gradient(160deg, rgba(var(--ion-color-primary-rgb), 0.45), rgba(var(--ion-color-tertiary-rgb), 0.45));
      box-shadow: var(--app-shadow-lifted);
      user-select: none;
    }
    img { display: block; width: 100%; height: 100%; object-fit: cover; pointer-events: none; }
    .no-photo { display: grid; place-items: center; height: 100%; font-size: 120px; }
    .bars { position: absolute; top: var(--app-space-2); left: var(--app-space-3); right: var(--app-space-3); display: flex; gap: var(--app-space-1); }
    .bars span { flex: 1; height: 4px; border-radius: var(--app-radius-pill); background: var(--app-on-scrim); opacity: 0.45; }
    .bars span.on { opacity: 1; }
    .info {
      position: absolute;
      inset: auto 0 0 0;
      padding: var(--app-space-7) var(--app-space-5) var(--app-space-5);
      background: linear-gradient(to top, var(--app-scrim), transparent);
      color: var(--app-on-scrim);
    }
    h2 { margin: 0; font-size: 1.8rem; font-weight: 900; }
    .age { font-weight: 600; }
    .sex { margin-inline-start: var(--app-space-2); }
    p { margin: var(--app-space-1) 0 0; font-weight: 600; }
    .place { opacity: 0.9; }
    .badge {
      display: inline-block;
      margin-top: var(--app-space-2);
      padding: 2px var(--app-space-3);
      border-radius: var(--app-radius-pill);
      background: var(--ion-color-warning);
      color: var(--ion-color-warning-contrast);
      font-size: 0.8rem;
      font-weight: 800;
    }
  `,
})
export class PetCardComponent {
  readonly card = input.required<PetCardData>();
  readonly photoIndex = input(0);
}
