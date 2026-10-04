import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';

/** Horizontal photo strip with native scroll snapping and dots. */
@Component({
  selector: 'app-photo-carousel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (urls().length) {
      <div class="strip" (scroll)="onScroll($event)">
        @for (url of urls(); track url) {
          <img [src]="url" alt="" loading="lazy" />
        }
      </div>
      @if (urls().length > 1) {
        <div class="dots" aria-hidden="true">
          @for (url of urls(); track url) {
            <span [class.on]="$index === index()"></span>
          }
        </div>
      }
    } @else {
      <div class="no-photo" aria-hidden="true">{{ emoji() }}</div>
    }
  `,
  styles: `
    :host { display: block; position: relative; }
    .strip {
      display: flex;
      overflow-x: auto;
      scroll-snap-type: x mandatory;
      scrollbar-width: none;
    }
    .strip::-webkit-scrollbar { display: none; }
    img { flex: 0 0 100%; width: 100%; aspect-ratio: 4 / 5; object-fit: cover; scroll-snap-align: start; }
    .no-photo {
      display: grid;
      place-items: center;
      aspect-ratio: 4 / 3;
      font-size: 96px;
      background: linear-gradient(160deg, rgba(var(--ion-color-primary-rgb), 0.45), rgba(var(--ion-color-tertiary-rgb), 0.45));
    }
    .dots {
      position: absolute;
      left: 0;
      right: 0;
      bottom: var(--app-space-3);
      display: flex;
      justify-content: center;
      gap: var(--app-space-1);
    }
    .dots span { width: 8px; height: 8px; border-radius: 50%; background: var(--app-on-scrim); opacity: 0.5; transition: opacity var(--app-duration-fast); }
    .dots span.on { opacity: 1; }
  `,
})
export class PhotoCarouselComponent {
  readonly urls = input.required<readonly string[]>();
  readonly emoji = input('🐾');

  protected readonly index = signal(0);

  protected onScroll(event: Event): void {
    const strip = event.target as HTMLElement;
    this.index.set(Math.round(strip.scrollLeft / (strip.clientWidth || 1)));
  }
}
