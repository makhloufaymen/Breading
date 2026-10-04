import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
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

  protected async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    this.serverError.set(null);
    try {
      const { email, password } = this.form.getRawValue();
      await this.auth.signIn(email.trim(), password);
      // navigateRoot replaces the whole navigation stack: "back" won't return to login.
      await this.nav.navigateRoot('/tabs/discover', { animationDirection: 'forward' });
      this.form.reset();
    } catch (error) {
      this.serverError.set(authErrorMessage(error));
    } finally {
      this.submitting.set(false);
    }
  }
}
