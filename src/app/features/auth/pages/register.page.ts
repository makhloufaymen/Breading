import { Component, inject, signal } from '@angular/core';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  IonButton,
  IonContent,
  IonInput,
  IonInputPasswordToggle,
  IonRouterLink,
  IonRouterLinkWithHref,
  IonSpinner,
  NavController,
} from '@ionic/angular';

import { authErrorMessage } from '../../../core/auth/auth-errors';
import { AuthStore } from '../../../core/auth/auth.store';
import { DISPLAY_NAME_MAX, DISPLAY_NAME_MIN } from '../../../core/models/profile.models';

const PASSWORD_MIN_LENGTH = 8; // keep in sync with supabase/config.toml

function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const password = group.get('password')?.value as string;
  const confirm = group.get('confirmPassword')?.value as string;
  return confirm && password !== confirm ? { passwordMismatch: true } : null;
}

@Component({
  selector: 'app-register',
  templateUrl: './register.page.html',
  styleUrl: './auth-page.scss',
  imports: [ReactiveFormsModule, RouterLink, IonRouterLink, IonRouterLinkWithHref, IonContent, IonInput, IonInputPasswordToggle, IonButton, IonSpinner],
})
export class RegisterPage {
  private readonly auth = inject(AuthStore);
  private readonly nav = inject(NavController);

  protected readonly passwordMinLength = PASSWORD_MIN_LENGTH;
  protected readonly form = inject(NonNullableFormBuilder).group(
    {
      displayName: ['', [Validators.required, Validators.minLength(DISPLAY_NAME_MIN), Validators.maxLength(DISPLAY_NAME_MAX)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(PASSWORD_MIN_LENGTH)]],
      confirmPassword: ['', Validators.required],
    },
    { validators: passwordsMatch },
  );
  protected readonly submitting = signal(false);
  protected readonly serverError = signal<string | null>(null);
  /** Set once signed up when the email must be confirmed: shows the "check your inbox" screen. */
  protected readonly sentTo = signal<string | null>(null);
  protected readonly resent = signal(false);

  protected async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    this.serverError.set(null);
    try {
      const { displayName, email, password } = this.form.getRawValue();
      const { confirmationRequired } = await this.auth.signUp({ displayName: displayName.trim(), email: email.trim(), password });
      if (confirmationRequired) {
        this.sentTo.set(email.trim());
      } else {
        // Confirmation disabled (some environments): the user is already signed in.
        await this.nav.navigateRoot('/tabs/discover', { animationDirection: 'forward' });
      }
      this.form.reset();
    } catch (error) {
      this.serverError.set(authErrorMessage(error));
    } finally {
      this.submitting.set(false);
    }
  }

  protected async resend(): Promise<void> {
    const email = this.sentTo();
    if (!email) return;
    this.serverError.set(null);
    try {
      await this.auth.resendConfirmation(email);
      this.resent.set(true);
    } catch (error) {
      this.serverError.set(authErrorMessage(error));
    }
  }
}
