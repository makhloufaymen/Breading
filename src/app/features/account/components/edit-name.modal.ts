import { Component, OnInit, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { IonButton, IonContent, IonInput, IonSpinner, ModalController } from '@ionic/angular';

import { DISPLAY_NAME_MAX, DISPLAY_NAME_MIN } from '../../../core/models/profile.models';
import { ProfileStore } from '../../../core/profile/profile.store';

/** Bottom sheet to change the owner's display name. Dismisses with role 'saved' on success. */
@Component({
  selector: 'app-edit-name-modal',
  template: `
    <ion-content class="ion-padding">
      <form [formGroup]="form" (ngSubmit)="save()" novalidate>
        <h2>Votre nom affiché</h2>
        <p class="hint">C'est ainsi que les autres propriétaires vous verront.</p>
        <ion-input
          formControlName="displayName"
          autocapitalize="words"
          label="Prénom ou pseudo"
          labelPlacement="stacked"
          [counter]="true"
          [maxlength]="max"
          [errorText]="'Entre ' + min + ' et ' + max + ' caractères.'"
        />
        @if (error()) {
          <p class="error" role="alert">L'enregistrement a échoué. Réessayez.</p>
        }
        <div class="actions">
          <ion-button fill="clear" color="medium" type="button" (click)="cancel()">Annuler</ion-button>
          <ion-button type="submit" [disabled]="saving()">
            @if (saving()) {
              <ion-spinner name="crescent" />
            } @else {
              Enregistrer
            }
          </ion-button>
        </div>
      </form>
    </ion-content>
  `,
  styles: `
    h2 { margin: var(--app-space-2) 0 0; font-weight: 800; }
    .hint { margin: var(--app-space-1) 0 var(--app-space-4); color: var(--ion-color-medium); }
    ion-input {
      --background: var(--app-surface-muted);
      --border-radius: var(--app-radius-md);
      --padding-start: var(--app-space-4);
      --padding-end: var(--app-space-4);
      font-weight: 600;
    }
    .error { margin: var(--app-space-3) 0 0; color: var(--ion-color-danger-shade); font-weight: 600; }
    .actions { display: flex; justify-content: flex-end; gap: var(--app-space-2); margin-top: var(--app-space-4); }
  `,
  imports: [ReactiveFormsModule, IonContent, IonInput, IonButton, IonSpinner],
})
export class EditNameModalComponent implements OnInit {
  /** Passed through ModalController componentProps. */
  readonly currentName = input('');

  private readonly modal = inject(ModalController);
  private readonly profiles = inject(ProfileStore);

  protected readonly min = DISPLAY_NAME_MIN;
  protected readonly max = DISPLAY_NAME_MAX;
  protected readonly form = inject(NonNullableFormBuilder).group({
    displayName: ['', [Validators.required, Validators.minLength(DISPLAY_NAME_MIN), Validators.maxLength(DISPLAY_NAME_MAX)]],
  });
  protected readonly saving = signal(false);
  protected readonly error = signal(false);

  ngOnInit(): void {
    this.form.setValue({ displayName: this.currentName() });
  }

  protected cancel(): void {
    void this.modal.dismiss(null, 'cancel');
  }

  protected async save(): Promise<void> {
    const displayName = this.form.getRawValue().displayName.trim();
    this.form.setValue({ displayName });
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.error.set(false);
    try {
      await this.profiles.updateDisplayName(displayName);
      await this.modal.dismiss(displayName, 'saved');
    } catch {
      this.error.set(true);
    } finally {
      this.saving.set(false);
    }
  }
}
