import createClient from 'openapi-fetch';
import type { paths } from './schema';

export const TOKEN_KEY = 'auth_token';

// Same-origin by default: requests go to `/v1/...` on the page's own host, and the Vite dev
// server proxies them to the backend (see vite.config.ts `server.proxy`). This avoids
// hitting `localhost:3001` directly from the browser — which breaks over HTTPS/remote hosts
// (mixed content + the "this site wants to access your device" private-network prompt).
// Set VITE_API_URL to point at an absolute API origin when not behind the proxy.
const baseUrl = import.meta.env.VITE_API_URL ?? '';

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
