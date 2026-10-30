'use client';

import { useActionState } from 'react';
import { submitUsername } from '../actions';

export function UsernameForm() {
  const [error, formAction, pending] = useActionState(submitUsername, null);

  return (
    <form action={formAction} className="username-form">
      <label className="field-label" htmlFor="username">
        GitHub username
      </label>
      <div className="field-row">
        <input
          id="username"
          name="username"
          className="text-input"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          required
          aria-describedby={error ? 'username-error' : 'username-hint'}
          aria-invalid={error ? true : undefined}
        />
        <button className="button" type="submit" disabled={pending}>
          {pending ? 'Finding issues…' : 'Find issues'}
        </button>
      </div>
      {error ? (
        <p id="username-error" className="field-error" role="alert">
          {error}
        </p>
      ) : (
        <p id="username-hint" className="hint">
          Only your public activity from the last 12 months is used. No login.
        </p>
      )}
    </form>
  );
}
