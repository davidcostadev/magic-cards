import createClient from 'openapi-fetch';
import type { paths } from './schema';

export const TOKEN_KEY = 'auth_token';

const baseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

export const apiClient = createClient<paths>({ baseUrl });

// Inject the JWT from localStorage on every request.
apiClient.use({
  onRequest({ request }) {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) request.headers.set('Authorization', `Bearer ${token}`);
    return request;
  },
});

export interface ApiErrorBody {
  error: { type: string; code: string; param?: string };
}

/** Extract the i18n error code from the Stripe-style error envelope. */
export function errorCode(error: unknown): string {
  const code = (error as ApiErrorBody | undefined)?.error?.code;
  return typeof code === 'string' ? code : 'errors.internal';
}
