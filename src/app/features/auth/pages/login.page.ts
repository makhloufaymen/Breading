import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { isAuthApiError } from '@supabase/supabase-js';
import {
  IonButton,
  IonContent,
  IonInput,
  IonInputPasswordToggle,
  IonRouterLinkWithHref,
  IonSpinner,
  NavController,
} from '@ionic/angular';

import { authErrorMessage } from '../../../core/auth/auth-errors';
import { AuthStore } from '../../../core/auth/auth.store';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrl: './auth-page.scss',
  imports: [ReactiveFormsModule, RouterLink, IonRouterLinkWithHref, IonContent, IonInput, IonInputPasswordToggle, IonButton, IonSpinner],
})
export class LoginPage {
  private readonly auth = inject(AuthStore);
  private readonly nav = inject(NavController);

  protected readonly form = inject(NonNullableFormBuilder).group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });
  protected readonly submitting = signal(false);
  protected readonly serverError = signal<string | null>(null);
  /** Sign-in refused because the email is not confirmed yet: offer to resend the link. */
  protected readonly unconfirmed = signal(false);
  protected readonly resent = signal(false);

  protected async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    this.serverError.set(null);
    this.unconfirmed.set(false);
    try {
      const { email, password } = this.form.getRawValue();
      await this.auth.signIn(email.trim(), password);
      // navigateRoot replaces the whole navigation stack: "back" won't return to login.
      await this.nav.navigateRoot('/tabs/discover', { animationDirection: 'forward' });
      this.form.reset();
    } catch (error) {
      this.serverError.set(authErrorMessage(error));
      this.unconfirmed.set(isAuthApiError(error) && error.code === 'email_not_confirmed');
      this.resent.set(false);
    } finally {
      this.submitting.set(false);
    }
  }

  protected async resend(): Promise<void> {
    try {
      await this.auth.resendConfirmation(this.form.getRawValue().email.trim());
      this.resent.set(true);
    } catch (error) {
      this.serverError.set(authErrorMessage(error));
    }
  }
}
