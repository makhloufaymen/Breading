import { AuthApiError } from '@supabase/supabase-js';

import { authErrorMessage } from './auth-errors';

describe('authErrorMessage', () => {
  it('translates wrong credentials', () => {
    const error = new AuthApiError('Invalid login credentials', 400, 'invalid_credentials');
    expect(authErrorMessage(error)).toBe('Email ou mot de passe incorrect.');
  });

  it('translates an already used email', () => {
    const error = new AuthApiError('User already registered', 422, 'user_already_exists');
    expect(authErrorMessage(error)).toBe('Un compte existe déjà avec cet email.');
  });

  it('detects network failures', () => {
    expect(authErrorMessage(new TypeError('Failed to fetch'))).toContain('Impossible de joindre le serveur');
  });

  it('falls back to a generic message', () => {
    expect(authErrorMessage('boom')).toBe('Une erreur inattendue est survenue. Réessayez.');
  });
});
