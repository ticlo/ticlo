import {AuthorizationRequiredError, authUrl, isBearerToken, normalizeResourceOrigin} from '@ticlo/core';

export interface OAuthClient {
  authorizationUrl: string;
  tokenUrl: string;
  clientId: string;
  redirectUri: string;
  resourceOrigin: string;
  scope: string;
  clientSecret?: string;
}

export interface OAuthClientCredentialsClient {
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  resourceOrigin: string;
  scope: string;
}

export interface OAuthGrant {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  issuedAt?: number;
  scope: string;
}

export type OAuthPopupResult = OAuthGrant | 'authorization-denied' | 'authorization-cancelled' | 'authorization-failed';

export class OAuthTokenError extends Error {}

export class OAuthGrantRequired extends AuthorizationRequiredError {
  constructor(message: string) {
    super(message);
  }
}

export function oauthClient(client: OAuthClient): Readonly<OAuthClient> {
  const resourceOrigin = normalizeResourceOrigin(client.resourceOrigin);
  authUrl(client.authorizationUrl);
  authUrl(client.tokenUrl);
  authUrl(client.redirectUri);
  if (!client.clientId) throw new Error('Invalid OAuth client');
  return Object.freeze({...client, resourceOrigin});
}

export function oauthClientCredentials(client: OAuthClientCredentialsClient): Readonly<OAuthClientCredentialsClient> {
  const resourceOrigin = normalizeResourceOrigin(client.resourceOrigin);
  authUrl(client.tokenUrl);
  if (!client.clientId || !client.clientSecret) throw new Error('Invalid OAuth client');
  return Object.freeze({...client, resourceOrigin});
}

const scopes = (scope: string) => scope.trim().split(/\s+/).filter(Boolean);
export function includesScopes(granted: string, required: string) {
  const available = new Set(scopes(granted));
  return scopes(required).every((scope) => available.has(scope));
}

export function isGrantUsable(grant: OAuthGrant, canRefresh: boolean, now = Date.now()): boolean {
  if (!canRefresh) return grant.expiresAt > now;
  const leeway =
    grant.issuedAt !== undefined
      ? Math.min(30_000, Math.max(0, Math.floor((grant.expiresAt - grant.issuedAt) / 4)))
      : 30_000;
  return grant.expiresAt - leeway > now;
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

async function requestToken(
  client: Pick<OAuthClient, 'tokenUrl' | 'clientId' | 'clientSecret'>,
  params: URLSearchParams,
  scope: string
): Promise<OAuthGrant> {
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
    throw new OAuthTokenError('Ticlo could not reach the OAuth token endpoint.');
  }
  const data = await response.json().catch((): null => null);
  if (data?.error === 'invalid_grant') {
    throw new OAuthGrantRequired('The OAuth provider rejected the grant. Start a new authorization request.');
  }
  if (!response.ok) {
    const reason =
      data?.error === 'invalid_client'
        ? 'The OAuth provider rejected the Client ID or Client Secret. Check the credentials and try again.'
        : `The OAuth token endpoint rejected the request (HTTP ${response.status}).`;
    throw new OAuthTokenError(reason);
  }
  if (
    !isBearerToken(data?.access_token) ||
    typeof data.token_type !== 'string' ||
    data.token_type.toLowerCase() !== 'bearer' ||
    (data.expires_in !== undefined && (!Number.isFinite(data.expires_in) || data.expires_in <= 0))
  )
    throw new OAuthTokenError('The OAuth token endpoint returned an invalid response.');
  const granted = typeof data.scope === 'string' ? data.scope : scope;
  if (!includesScopes(granted, scope)) {
    throw new OAuthGrantRequired('The OAuth provider did not grant all requested permissions.');
  }
  const now = Date.now();
  return {
    accessToken: data.access_token,
    refreshToken: typeof data.refresh_token === 'string' ? data.refresh_token : undefined,
    issuedAt: now,
    expiresAt: now + (data.expires_in ?? 300) * 1000,
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
  if (!grant.refreshToken) throw new AuthorizationRequiredError();
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

export function requestClientCredentials(client: OAuthClientCredentialsClient, scope = client.scope) {
  const params = new URLSearchParams({grant_type: 'client_credentials'});
  if (scope) params.set('scope', scope);
  return requestToken(client, params, scope);
}
