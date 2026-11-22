import type {Root} from '../../block/Flow.ts';

export interface OAuthClient {
  authorizationUrl: string;
  tokenUrl: string;
  clientId: string;
  redirectUri: string;
  resourceOrigin: string;
  scope: string;
  clientSecret?: string;
}

export interface OAuthGrant {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  scope: string;
}

export class OAuthRequired extends Error {
  constructor() {
    super('OAuth authorization required');
    this.name = 'authorization-required';
  }
}

export type OAuthSource = 'connection' | 'currentUser';
export interface OAuthHost {
  origin(connection: string): string;
  token(connection: string, scope: string, source: OAuthSource, context: unknown): Promise<string>;
  connect(connection: string, scope: string, isCurrent: () => boolean): string;
  status(connection: string, scope: string): Promise<string>;
}

export type OAuthPopupResult = OAuthGrant | 'authorization-denied' | 'authorization-cancelled' | 'authorization-failed';

export const oauthHosts = new WeakMap<Root, OAuthHost>();
export const oauthProfiles = new WeakMap<object, {origin: string; token(context: unknown): Promise<string>}>();

export function isBearerToken(value: unknown): value is string {
  return typeof value === 'string' && /^[a-zA-Z0-9._~+/-]+=*$/.test(value);
}

export function oauthUrl(value: string) {
  const url = new URL(value);
  if (
    url.username ||
    url.password ||
    url.hash ||
    (url.protocol !== 'https:' &&
      !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))
  )
    throw new Error('Invalid OAuth URL');
  return url;
}

export function oauthClient(client: OAuthClient): Readonly<OAuthClient> {
  const resource = oauthUrl(client.resourceOrigin);
  oauthUrl(client.authorizationUrl);
  oauthUrl(client.tokenUrl);
  oauthUrl(client.redirectUri);
  if (!client.clientId || resource.href !== `${resource.origin}/`) throw new Error('Invalid OAuth client');
  return Object.freeze({...client, resourceOrigin: resource.origin});
}

const scopes = (scope: string) => scope.trim().split(/\s+/).filter(Boolean);
export function includesScopes(granted: string, required: string) {
  const available = new Set(scopes(granted));
  return scopes(required).every((scope) => available.has(scope));
}

const base64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
export const oauthState = () => base64url(crypto.getRandomValues(new Uint8Array(32)));
export const oauthLifetime = 5 * 60_000;

export async function beginOAuth(client: OAuthClient, scope = client.scope) {
  const verifier = oauthState();
  const state = oauthState();
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  const url = new URL(client.authorizationUrl);
  for (const [key, value] of Object.entries({
    response_type: 'code',
    client_id: client.clientId,
    redirect_uri: client.redirectUri,
    scope,
    state,
    code_challenge: base64url(new Uint8Array(digest)),
    code_challenge_method: 'S256',
  }))
    url.searchParams.set(key, value);
  return {url: url.href, state, verifier, expires: Date.now() + oauthLifetime};
}

async function requestToken(client: OAuthClient, params: URLSearchParams, scope: string): Promise<OAuthGrant> {
  const headers = new Headers({'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json'});
  if (client.clientSecret !== undefined) {
    const encode = (value: string) => new URLSearchParams([['', value]]).toString().slice(1);
    headers.set('Authorization', `Basic ${btoa(`${encode(client.clientId)}:${encode(client.clientSecret)}`)}`);
  } else {
    params.set('client_id', client.clientId);
  }
  let response: Response;
  try {
    response = await fetch(client.tokenUrl, {
      method: 'POST',
      headers,
      body: params,
      redirect: 'error',
      credentials: 'omit',
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new Error('OAuth token endpoint unavailable');
  }
  const data = await response.json().catch((): null => null);
  if (data?.error === 'invalid_grant') throw new OAuthRequired();
  if (
    !response.ok ||
    !isBearerToken(data?.access_token) ||
    typeof data.token_type !== 'string' ||
    data.token_type.toLowerCase() !== 'bearer' ||
    (data.expires_in !== undefined && (!Number.isFinite(data.expires_in) || data.expires_in <= 0))
  )
    throw new Error('Invalid OAuth token response');
  const granted = typeof data.scope === 'string' ? data.scope : scope;
  if (!includesScopes(granted, scope)) throw new OAuthRequired();
  return {
    accessToken: data.access_token,
    refreshToken: typeof data.refresh_token === 'string' ? data.refresh_token : undefined,
    expiresAt: Date.now() + (data.expires_in ?? 300) * 1000,
    scope: granted,
  };
}

export function exchangeOAuth(client: OAuthClient, code: string, verifier: string, scope: string) {
  return requestToken(
    client,
    new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      code_verifier: verifier,
      redirect_uri: client.redirectUri,
    }),
    scope
  );
}

export async function refreshOAuth(client: OAuthClient, grant: OAuthGrant) {
  if (!grant.refreshToken) throw new OAuthRequired();
  const next = await requestToken(
    client,
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: grant.refreshToken,
    }),
    grant.scope
  );
  next.refreshToken ??= grant.refreshToken;
  return next;
}
