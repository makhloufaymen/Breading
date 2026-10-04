import { isAuthApiError } from '@supabase/supabase-js';

/**
 * Turns a Supabase Auth error into a French message for the UI.
 * Codes: https://supabase.com/docs/guides/auth/debugging/error-codes
 */
export function authErrorMessage(error: unknown): string {
  if (isAuthApiError(error)) {
    switch (error.code) {
      case 'invalid_credentials':
        return 'Email ou mot de passe incorrect.';
      case 'user_already_exists':
      case 'email_exists':
        return 'Un compte existe déjà avec cet email.';
      case 'weak_password':
        return 'Mot de passe trop faible : au moins 8 caractères.';
      case 'email_address_invalid':
        return "Cette adresse email n'est pas valide.";
      case 'over_request_rate_limit':
      case 'over_email_send_rate_limit':
        return 'Trop de tentatives. Réessayez dans quelques minutes.';
      case 'signup_disabled':
        return 'Les inscriptions sont momentanément fermées.';
    }
  }
  if (error instanceof Error && /fetch|network/i.test(error.message)) {
    return 'Impossible de joindre le serveur. Vérifiez votre connexion.';
  }
  return 'Une erreur inattendue est survenue. Réessayez.';
}
