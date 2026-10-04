import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Friendly placeholder shown when a screen has nothing to display yet. */
@Component({
  selector: 'app-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="empty-state">
      <div class="emoji" aria-hidden="true">{{ emoji() }}</div>
      <h2>{{ title() }}</h2>
      @if (message()) {
        <p>{{ message() }}</p>
      }
      <ng-content />
    </div>
  `,
  styleUrl: './empty-state.component.scss',
})
export class EmptyStateComponent {
  readonly emoji = input.required<string>();
  readonly title = input.required<string>();
  readonly message = input<string>();
}
