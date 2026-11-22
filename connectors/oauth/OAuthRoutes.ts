import type {Context, Hono, MiddlewareHandler} from 'hono';
import {NoSerialize} from '@ticlo/core/util/NoSerialize.ts';
import {AuthorizationRequiredError, authUrl, type OAuthToken, type OAuthTokenOptions, type Root} from '@ticlo/core';
import {createHash} from 'node:crypto';
import {
  OAuthGrantRequired,
  OAuthTokenError,
  beginOAuth,
  exchangeOAuth,
  includesScopes,
  isGrantUsable,
  oauthClient,
  oauthClientCredentials,
  oauthLifetime,
  oauthState,
  refreshOAuth,
  requestClientCredentials,
  type OAuthClient,
  type OAuthClientCredentialsClient,
  type OAuthGrant,
} from './OAuth.ts';

export interface OAuthGrantStore {
  get(key: string): Promise<OAuthGrant | undefined>;
  set(key: string, grant: OAuthGrant | undefined): Promise<void>;
}

export type OAuthConnectionConfig =
  | (Omit<OAuthClient, 'redirectUri'> & {grantType?: 'authorization_code'})
  | (OAuthClientCredentialsClient & {grantType: 'client_credentials'});

export interface OAuthServerOptions {
  /** Public origin serving these routes and receiving the provider's callback. */
  origin: string;
  connections?: Readonly<Record<string, OAuthConnectionConfig>>;
  /** Permit trusted Flow authors to configure providers. */
  allowFlowClients?: boolean;
  /** Skip the confirmation page when the host has already obtained the user's intent. */
  confirmAuthorization?: boolean;
  store: OAuthGrantStore;
  /** Resolve the current session ID after checking permission to manage this connection. */
  authorize(context: Context, connection: string): string | undefined | Promise<string | undefined>;
  /** Resolve a user grant for the authenticated incoming request. */
  userGrant?(context: Context, connection: string, scope: string): Promise<OAuthGrant | undefined>;
}

export type OAuthSource = 'connection' | 'currentUser';

export type Registration =
  | {
      grantType: 'authorization_code';
      name: string;
      client: Readonly<OAuthClient>;
      key: string;
    }
  | {
      grantType: 'client_credentials';
      name: string;
      client: Readonly<OAuthClientCredentialsClient>;
      key: string;
    };

export type AuthCodeRegistration = Extract<Registration, {grantType: 'authorization_code'}>;

interface OAuthHost {
  readonly allowFlowClients: boolean;
  named(name: string): Registration;
  configure(name: string, owner: string, config: Omit<OAuthClient, 'redirectUri'>): AuthCodeRegistration;
  connect(registration: AuthCodeRegistration, scope: string, authorization: OAuthAuthorization): string;
  status(registration: Registration, scope: string): Promise<string>;
  token(
    registration: Registration,
    scope: string,
    source: OAuthSource,
    context: unknown,
    options?: OAuthTokenOptions
  ): Promise<OAuthToken>;
  observe(key: string, listener: (status: string) => void): {close(): void};
}

export const oauthHosts = new WeakMap<Root, OAuthHost>();

interface OAuthAuthorization {
  current(): boolean;
  pending(): void;
  complete(status: string): void;
}

interface Ticket extends OAuthAuthorization {
  registration: AuthCodeRegistration;
  scope: string;
  expires: number;
}

interface Pending extends Ticket {
  verifier: string;
  session: string;
}

function resultPage(context: Context, message: string, status: 200 | 400 | 403 | 409 = 200) {
  return context.html(`<!doctype html><meta charset="utf-8"><title>Ticlo OAuth</title><p>${message}</p>`, status);
}

export function routeOAuth(app: Hono, root: Root, options: OAuthServerOptions, apiPath = '/api') {
  const origin = authUrl(options.origin).origin;
  function registration(name: string, config: OAuthConnectionConfig, owner?: string): Registration {
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) throw new Error('Invalid OAuth connection name');
    if (config.grantType === 'client_credentials') {
      const client = oauthClientCredentials(config);
      const fingerprint = ['client_credentials', client.tokenUrl, client.clientId, client.resourceOrigin, client.scope];
      if (owner !== undefined) fingerprint.push(owner);
      const key = `${name}.${createHash('sha256').update(JSON.stringify(fingerprint)).digest('hex')}`;
      return {grantType: 'client_credentials', name, client, key};
    }
    const client = oauthClient({...config, redirectUri: `${origin}/oauth/callback/${name}`});
    const fingerprint = [
      client.authorizationUrl,
      client.tokenUrl,
      client.clientId,
      client.redirectUri,
      client.resourceOrigin,
      client.scope,
    ];
    if (owner !== undefined) fingerprint.push(owner);
    const key = `${name}.${createHash('sha256').update(JSON.stringify(fingerprint)).digest('hex')}`;
    return {grantType: 'authorization_code', name, client, key};
  }
  const clients = new Map(
    Object.entries(options.connections ?? {}).map(([name, config]) => [name, registration(name, config)])
  );
  const tickets = new Map<string, Ticket>();
  const pending = new Map<string, Pending>();
  const active = new Map<string, string>();
  const operations = new Map<string, Promise<unknown>>();
  const statusListeners = new Map<string, Set<(status: string) => void>>();
  const notifyStatus = (key: string, status: string) => {
    const listeners = statusListeners.get(key);
    if (!listeners) return;
    for (const listener of [...listeners]) listener(status);
  };
  const serialized = <T>(name: string, task: () => Promise<T>) => {
    const next = (operations.get(name) ?? Promise.resolve()).then(task);
    const settled = next.catch(() => {});
    operations.set(name, settled);
    return next.finally(() => {
      if (operations.get(name) === settled) operations.delete(name);
    });
  };
  const clearExpired = () => {
    const now = Date.now();
    for (const [key, ticket] of tickets) {
      if (ticket.expires > now && ticket.current()) continue;
      tickets.delete(key);
      if (ticket.current()) ticket.complete('authorization-expired');
    }
    for (const [state, ticket] of pending) {
      if (ticket.expires > now && ticket.current()) continue;
      pending.delete(state);
      if (active.get(ticket.registration.key) === state) active.delete(ticket.registration.key);
      if (ticket.current()) ticket.complete('authorization-expired');
    }
  };
  const validGrant = (grant: OAuthGrant | undefined, scope: string): grant is OAuthGrant =>
    Boolean(grant && includesScopes(grant.scope, scope));

  const contexts = new WeakMap<object, Context>();
  if (options.userGrant) {
    const bindRequest: MiddlewareHandler<{Variables: {ticloAuthContext: object}}> = async (c, next) => {
      const handle = Object.freeze(new NoSerialize('auth:request-context'));
      contexts.set(handle, c);
      c.set('ticloAuthContext', handle);
      try {
        await next();
      } finally {
        contexts.delete(handle);
      }
    };
    app.use(`${apiPath}/*`, bindRequest);
  }

  oauthHosts.set(root, {
    allowFlowClients: Boolean(options.allowFlowClients),
    named(name) {
      const entry = clients.get(name);
      if (!entry) throw new Error('Unknown OAuth connection');
      return entry;
    },
    configure(name, owner, config) {
      if (!options.allowFlowClients) throw new Error('Flow-configured OAuth is disabled on this host');
      return registration(name, config, owner) as AuthCodeRegistration;
    },
    connect(entry, scope, authorization) {
      if (!includesScopes(entry.client.scope, scope))
        throw new Error('OAuth scope is outside the configured connection');
      clearExpired();
      if (tickets.size >= 256) throw new Error('Too many pending OAuth requests');
      const key = oauthState();
      tickets.set(key, {
        registration: entry,
        scope: entry.client.scope,
        ...authorization,
        expires: Date.now() + oauthLifetime,
      });
      return `${origin}/oauth/start/${key}`;
    },
    async status(entry, scope) {
      if (entry.grantType === 'client_credentials') {
        const grant = await options.store.get(entry.key);
        return validGrant(grant, scope) && isGrantUsable(grant, true) ? 'authorized' : 'ready';
      }
      clearExpired();
      if (active.has(entry.key)) return 'authorization-pending';
      const grant = await options.store.get(entry.key);
      return validGrant(grant, scope) && (grant.expiresAt > Date.now() || Boolean(grant.refreshToken))
        ? 'authorized'
        : 'authorization-required';
    },
    async token(entry, scope, source, context, tokenOptions) {
      if (!includesScopes(entry.client.scope, scope)) throw new AuthorizationRequiredError();
      if (entry.grantType === 'client_credentials') {
        if (source === 'currentUser') throw new AuthorizationRequiredError();
        const read = async () => {
          const grant = await options.store.get(entry.key);
          return validGrant(grant, scope) ? grant : undefined;
        };
        const grant = await read();
        if (!tokenOptions?.forceRefresh && grant && isGrantUsable(grant, true)) {
          return {accessToken: grant.accessToken, expiresAt: grant.expiresAt};
        }
        return serialized(entry.key, async () => {
          const latest = await read();
          if (latest && isGrantUsable(latest, true)) {
            if (!tokenOptions?.forceRefresh) {
              return {accessToken: latest.accessToken, expiresAt: latest.expiresAt};
            }
            if (tokenOptions.rejectedToken && latest.accessToken !== tokenOptions.rejectedToken) {
              return {accessToken: latest.accessToken, expiresAt: latest.expiresAt};
            }
          }
          const next = await requestClientCredentials(entry.client, entry.client.scope);
          await options.store.set(entry.key, next);
          notifyStatus(entry.key, 'authorized');
          return {accessToken: next.accessToken, expiresAt: next.expiresAt};
        });
      }
      const {client, name, key} = entry;
      if (source === 'currentUser') {
        const request = contexts.get(context as object);
        if (!request) throw new AuthorizationRequiredError();
        const grant = await options.userGrant(request, name, scope);
        if (!contexts.has(context as object) || !validGrant(grant, scope) || !(grant.expiresAt > Date.now()))
          throw new AuthorizationRequiredError();
        return {accessToken: grant.accessToken, expiresAt: grant.expiresAt};
      }
      const read = async () => {
        const grant = await options.store.get(key);
        if (!validGrant(grant, scope)) throw new AuthorizationRequiredError();
        return grant;
      };
      const grant = await read();
      if (!tokenOptions?.forceRefresh && isGrantUsable(grant, Boolean(grant.refreshToken))) {
        return {accessToken: grant.accessToken, expiresAt: grant.expiresAt};
      }
      return serialized(key, async () => {
        const latest = await read();
        if (isGrantUsable(latest, Boolean(latest.refreshToken))) {
          if (!tokenOptions?.forceRefresh) {
            return {accessToken: latest.accessToken, expiresAt: latest.expiresAt};
          }
          if (tokenOptions.rejectedToken && latest.accessToken !== tokenOptions.rejectedToken) {
            return {accessToken: latest.accessToken, expiresAt: latest.expiresAt};
          }
        }
        try {
          const refreshed = await refreshOAuth(client, latest);
          await options.store.set(key, refreshed);
          notifyStatus(key, 'authorized');
          return {accessToken: refreshed.accessToken, expiresAt: refreshed.expiresAt};
        } catch (error) {
          if (error instanceof AuthorizationRequiredError) {
            await options.store.set(key, undefined);
            notifyStatus(key, 'authorization-required');
          }
          throw error;
        }
      });
    },
    observe(key, listener) {
      let listeners = statusListeners.get(key);
      if (!listeners) {
        listeners = new Set();
        statusListeners.set(key, listeners);
      }
      listeners.add(listener);
      return {
        close() {
          listeners.delete(listener);
          if (!listeners.size) statusListeners.delete(key);
        },
      };
    },
  });

  app.use('/oauth/*', async (c, next) => {
    c.header('Cache-Control', 'no-store');
    c.header('Referrer-Policy', 'no-referrer');
    c.header('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; form-action 'self'");
    await next();
  });
  async function startAuthorization(c: Context, key: string, ticket: Ticket, session: string) {
    const transaction = await beginOAuth(ticket.registration.client, ticket.scope);
    if (!tickets.delete(key) || !ticket.current() || ticket.expires <= Date.now()) {
      return resultPage(c, 'This authorization link has expired.', 400);
    }
    const id = ticket.registration.key;
    const previous = active.get(id);
    if (previous) pending.delete(previous);
    if (pending.size >= 256) return resultPage(c, 'Too many pending authorization requests.', 409);
    pending.set(transaction.state, {...ticket, expires: transaction.expires, verifier: transaction.verifier, session});
    active.set(id, transaction.state);
    ticket.pending();
    return c.redirect(transaction.url, 303);
  }
  app.get('/oauth/start/:key', async (c) => {
    clearExpired();
    const key = c.req.param('key');
    const ticket = tickets.get(key);
    if (!ticket) return resultPage(c, 'This authorization link has expired.', 400);
    const session = await options.authorize(c, ticket.registration.name);
    if (!session) return resultPage(c, 'Ticlo authorization required.', 403);
    if (options.confirmAuthorization === false) return startAuthorization(c, key, ticket, session);
    const providerOrigin = new URL(ticket.registration.client.authorizationUrl).origin;
    // Keep the form POST's same-origin Origin header and permit its redirect to the provider.
    c.header('Referrer-Policy', 'same-origin');
    c.header(
      'Content-Security-Policy',
      `default-src 'none'; frame-ancestors 'none'; form-action 'self' ${providerOrigin}`
    );
    return c.html(`<!doctype html><meta charset="utf-8"><title>Ticlo OAuth</title>
      <p>Connect an account to <strong>${ticket.registration.name}</strong> on this Ticlo host.</p>
      <form method="post"><button type="submit">Continue to the OAuth provider</button></form>`);
  });
  app.post('/oauth/start/:key', async (c) => {
    clearExpired();
    if (c.req.header('Origin') !== origin) return resultPage(c, 'Invalid authorization origin.', 403);
    const key = c.req.param('key');
    const ticket = tickets.get(key);
    if (!ticket) return resultPage(c, 'This authorization link has expired.', 400);
    const session = await options.authorize(c, ticket.registration.name);
    if (!session) return resultPage(c, 'Ticlo authorization required.', 403);
    return startAuthorization(c, key, ticket, session);
  });
  app.get('/oauth/callback/:name', async (c) => {
    clearExpired();
    const connection = c.req.param('name');
    const state = c.req.query('state');
    const ticket = pending.get(state);
    if (!ticket || ticket.registration.name !== connection)
      return resultPage(c, 'Invalid or expired authorization.', 400);
    const session = await options.authorize(c, connection);
    if (!session || session !== ticket.session) return resultPage(c, 'Authorization belongs to another session.', 403);
    if (!pending.delete(state)) return resultPage(c, 'Authorization has already been completed.', 400);
    const {key, client} = ticket.registration;
    const current = () => active.get(key) === state && ticket.current() && ticket.expires > Date.now();
    try {
      const code = c.req.query('code');
      const error = c.req.query('error');
      if (error || !code) {
        if (current()) ticket.complete(error === 'access_denied' ? 'authorization-denied' : 'authorization-failed');
        return resultPage(c, 'Authorization was declined or failed.', 400);
      }
      const stored = await serialized(key, async () => {
        if (!current()) return false;
        const grant = await exchangeOAuth(client, code, ticket.verifier, ticket.scope);
        if (!current()) return false;
        await options.store.set(key, grant);
        if (current()) {
          active.delete(key);
          ticket.complete('authorized');
          notifyStatus(key, 'authorized');
        }
        return true;
      });
      return stored
        ? resultPage(c, 'Authorization saved. You can close this window.')
        : resultPage(c, 'The authorization target changed. Start a new authorization request.', 409);
    } catch (error) {
      if (current()) ticket.complete('authorization-failed');
      return resultPage(
        c,
        error instanceof OAuthTokenError || error instanceof OAuthGrantRequired
          ? error.message
          : 'Ticlo could not save the authorization grant.',
        400
      );
    } finally {
      if (active.get(key) === state) active.delete(key);
    }
  });
}
