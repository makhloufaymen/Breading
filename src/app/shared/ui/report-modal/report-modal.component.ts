import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonFooter,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonRadio,
  IonRadioGroup,
  IonTextarea,
  IonTitle,
  IonToggle,
  IonToolbar,
  ModalController,
} from '@ionic/angular';

import type { ReportReason } from '../../../core/safety/safety.repository';

export interface ReportChoice {
  readonly reason: ReportReason;
  readonly details: string;
  readonly block: boolean;
}

const REASONS: readonly { value: ReportReason; label: string }[] = [
  { value: 'fake_profile', label: 'Faux profil ou photos volées' },
  { value: 'inappropriate_content', label: 'Contenu inapproprié' },
  { value: 'harassment', label: 'Harcèlement ou messages insultants' },
  { value: 'scam', label: 'Arnaque ou demande d’argent' },
  { value: 'animal_welfare', label: 'Bien-être animal en danger' },
  { value: 'other', label: 'Autre' },
];

const DETAILS_MAX = 1000;

/** Report form. Dismisses with role 'report' and a ReportChoice. */
@Component({
  selector: 'app-report-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button (click)="cancel()">Annuler</ion-button>
        </ion-buttons>
        <ion-title>Signaler</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <p class="intro">Que se passe-t-il avec {{ ownerName() }} ? Votre signalement reste anonyme.</p>
      <ion-list lines="none">
        <ion-radio-group [value]="reason()" (ionChange)="reason.set($event.detail.value)">
          @for (r of reasons; track r.value) {
            <ion-item>
              <ion-radio [value]="r.value" justify="space-between">{{ r.label }}</ion-radio>
            </ion-item>
          }
        </ion-radio-group>
      </ion-list>
      <ion-textarea
        label="Précisions (facultatif)"
        labelPlacement="stacked"
        [autoGrow]="true"
        [rows]="3"
        [counter]="true"
        [maxlength]="detailsMax"
        [value]="details()"
        (ionInput)="details.set($event.detail.value ?? '')"
      />
      <ion-item lines="none" class="block">
        <ion-toggle [checked]="block()" (ionChange)="block.set($event.detail.checked)" justify="space-between">
          <ion-label>
            <strong>Bloquer aussi {{ ownerName() }}</strong>
            <p>Vous ne vous verrez plus et vos matchs seront supprimés.</p>
          </ion-label>
        </ion-toggle>
      </ion-item>
    </ion-content>
    <ion-footer>
      <ion-toolbar>
        <ion-button expand="block" color="danger" [disabled]="!reason()" (click)="send()">Envoyer le signalement</ion-button>
      </ion-toolbar>
    </ion-footer>
  `,
  styles: `
    .intro { margin-top: 0; color: var(--ion-color-medium); }
    ion-list { background: transparent; }
    ion-item { --background: transparent; font-weight: 600; }
    ion-textarea {
      margin-top: var(--app-space-3);
      --background: var(--app-surface-muted);
      --border-radius: var(--app-radius-md);
      --padding-start: var(--app-space-4);
      --padding-end: var(--app-space-4);
    }
    .block { margin-top: var(--app-space-3); }
    .block p { color: var(--ion-color-medium); font-weight: 400; white-space: normal; }
    ion-footer ion-toolbar { --padding-start: var(--app-space-4); --padding-end: var(--app-space-4); }
  `,
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonContent,
    IonFooter,
    IonList,
    IonItem,
    IonLabel,
    IonRadioGroup,
    IonRadio,
    IonTextarea,
    IonToggle,
  ],
})
export class ReportModalComponent {
  /** Passed through ModalController componentProps. */
  readonly ownerName = input.required<string>();

  // Not named "modal": Ionic writes the <ion-modal> element into that property.
  private readonly modals = inject(ModalController);

  protected readonly reasons = REASONS;
  protected readonly detailsMax = DETAILS_MAX;
  protected readonly reason = signal<ReportReason | null>(null);
  protected readonly details = signal('');
  /** Blocking is the usual next step: on by default. */
  protected readonly block = signal(true);

  protected cancel(): void {
    void this.modals.dismiss(null, 'cancel');
  }

  protected send(): void {
    const reason = this.reason();
    if (!reason) return;
    const choice: ReportChoice = { reason, details: this.details().trim(), block: this.block() };
    void this.modals.dismiss(choice, 'report');
  }
}
