import type { TokenSource } from './github-user-client';

export function environmentTokenSource(
  environment: NodeJS.ProcessEnv = process.env,
): TokenSource {
  return {
    async getToken() {
      const token = environment.GITHUB_TOKEN;
      if (!token) throw new Error('GITHUB_TOKEN is not set');
      return token;
    },
  };
}
