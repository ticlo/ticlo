import type {Context, Hono, MiddlewareHandler} from 'hono';
import {NoSerialize} from '@ticlo/core/util/NoSerialize.ts';
import type {Root} from '@ticlo/core';
import {createHash} from 'node:crypto';
import {
  beginOAuth,
  exchangeOAuth,
  includesScopes,
  oauthClient,
  oauthHosts,
  oauthLifetime,
  OAuthRequired,
  oauthState,
  oauthUrl,
  refreshOAuth,
  type OAuthClient,
  type OAuthGrant,
} from '@ticlo/core/functions/auth/OAuth.ts';

export interface OAuthGrantStore {
  get(key: string): Promise<OAuthGrant | undefined>;
  set(key: string, grant: OAuthGrant | undefined): Promise<void>;
}

export interface OAuthServerOptions {
  /** Public origin serving these routes and receiving the provider's callback. */
  origin: string;
  connections: Readonly<Record<string, Omit<OAuthClient, 'redirectUri'>>>;
  store: OAuthGrantStore;
  /** Resolve the current session ID after checking permission to manage this connection. */
  authorize(context: Context, connection: string): string | undefined | Promise<string | undefined>;
  /** Resolve a user grant for the authenticated incoming request. */
  userGrant?(context: Context, connection: string, scope: string): Promise<OAuthGrant | undefined>;
}

interface Ticket {
  connection: string;
  scope: string;
  current(): boolean;
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
  const origin = oauthUrl(options.origin).origin;
  const clients = new Map(
    Object.entries(options.connections).map(([name, client]) => {
      if (!/^[a-zA-Z0-9_-]+$/.test(name)) throw new Error('Invalid OAuth connection name');
      return [name, oauthClient({...client, redirectUri: `${origin}/oauth/callback/${name}`})];
    })
  );
  const storeKeys = new Map(
    [...clients].map(([name, client]) => {
      const config = [
        client.authorizationUrl,
        client.tokenUrl,
        client.clientId,
        client.redirectUri,
        client.resourceOrigin,
        client.scope,
      ];
      return [name, `${name}.${createHash('sha256').update(JSON.stringify(config)).digest('hex')}`];
    })
  );
  const readGrant = (name: string) => options.store.get(storeKeys.get(name));
  const writeGrant = (name: string, grant: OAuthGrant | undefined) => options.store.set(storeKeys.get(name), grant);
  const tickets = new Map<string, Ticket>();
  const pending = new Map<string, Pending>();
  const active = new Map<string, string>();
  const operations = new Map<string, Promise<unknown>>();
  const serialized = <T>(name: string, task: () => Promise<T>) => {
    const next = (operations.get(name) ?? Promise.resolve()).then(task);
    const settled = next.catch(() => {});
    operations.set(name, settled);
    return next.finally(() => {
      if (operations.get(name) === settled) operations.delete(name);
    });
  };
  const getClient = (name: string) => {
    const client = clients.get(name);
    if (!client) throw new Error('Unknown OAuth connection');
    return client;
  };
  const clearExpired = () => {
    const now = Date.now();
    for (const [key, ticket] of tickets) if (ticket.expires <= now || !ticket.current()) tickets.delete(key);
    for (const [state, ticket] of pending) {
      if (ticket.expires > now && ticket.current()) continue;
      pending.delete(state);
      if (active.get(ticket.connection) === state) active.delete(ticket.connection);
    }
  };
  const validGrant = (grant: OAuthGrant | undefined, scope: string) => grant && includesScopes(grant.scope, scope);

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
    origin: (name) => getClient(name).resourceOrigin,
    connect(connection, scope, current) {
      const client = getClient(connection);
      if (!includesScopes(client.scope, scope)) throw new Error('OAuth scope is outside the configured connection');
      clearExpired();
      if (tickets.size >= 256) throw new Error('Too many pending OAuth requests');
      const key = oauthState();
      tickets.set(key, {connection, scope: client.scope, current, expires: Date.now() + oauthLifetime});
      return `${origin}/oauth/start/${key}`;
    },
    async status(connection, scope) {
      clearExpired();
      if (active.has(connection)) return 'authorization-pending';
      const grant = await readGrant(connection);
      return validGrant(grant, scope) && (grant.expiresAt > Date.now() || grant.refreshToken)
        ? 'authorized'
        : 'authorization-required';
    },
    async token(connection, scope, source, context) {
      const client = getClient(connection);
      if (!includesScopes(client.scope, scope)) throw new OAuthRequired();
      if (source === 'currentUser') {
        const request = contexts.get(context as object);
        if (!request) throw new OAuthRequired();
        const grant = await options.userGrant(request, connection, scope);
        if (!contexts.has(context as object) || !validGrant(grant, scope) || !(grant.expiresAt > Date.now()))
          throw new OAuthRequired();
        return grant.accessToken;
      }
      const read = async () => {
        const grant = await readGrant(connection);
        if (!validGrant(grant, scope)) throw new OAuthRequired();
        return grant;
      };
      const grant = await read();
      if (grant.expiresAt > Date.now()) return grant.accessToken;
      return serialized(connection, async () => {
        const latest = await read();
        if (latest.expiresAt > Date.now()) return latest.accessToken;
        try {
          const refreshed = await refreshOAuth(client, latest);
          await writeGrant(connection, refreshed);
          return refreshed.accessToken;
        } catch (error) {
          if (error instanceof OAuthRequired) await writeGrant(connection, undefined);
          throw error;
        }
      });
    },
  });

  app.use('/oauth/*', async (c, next) => {
    c.header('Cache-Control', 'no-store');
    c.header('Referrer-Policy', 'no-referrer');
    c.header('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; form-action 'self'");
    await next();
  });
  app.get('/oauth/start/:key', async (c) => {
    clearExpired();
    const ticket = tickets.get(c.req.param('key'));
    if (!ticket) return resultPage(c, 'This authorization link has expired.', 400);
    if (!(await options.authorize(c, ticket.connection))) return resultPage(c, 'Ticlo authorization required.', 403);
    const providerOrigin = new URL(getClient(ticket.connection).authorizationUrl).origin;
    // Keep the form POST's same-origin Origin header and permit its redirect to the provider.
    c.header('Referrer-Policy', 'same-origin');
    c.header(
      'Content-Security-Policy',
      `default-src 'none'; frame-ancestors 'none'; form-action 'self' ${providerOrigin}`
    );
    return c.html(`<!doctype html><meta charset="utf-8"><title>Ticlo OAuth</title>
      <p>Connect an account to <strong>${ticket.connection}</strong> on this Ticlo host.</p>
      <form method="post"><button type="submit">Continue to the OAuth provider</button></form>`);
  });
  app.post('/oauth/start/:key', async (c) => {
    clearExpired();
    if (c.req.header('Origin') !== origin) return resultPage(c, 'Invalid authorization origin.', 403);
    const key = c.req.param('key');
    const ticket = tickets.get(key);
    if (!ticket) return resultPage(c, 'This authorization link has expired.', 400);
    const session = await options.authorize(c, ticket.connection);
    if (!session) return resultPage(c, 'Ticlo authorization required.', 403);
    const transaction = await beginOAuth(getClient(ticket.connection), ticket.scope);
    if (!tickets.delete(key) || !ticket.current() || ticket.expires <= Date.now()) {
      return resultPage(c, 'This authorization link has expired.', 400);
    }
    const previous = active.get(ticket.connection);
    if (previous) pending.delete(previous);
    if (pending.size >= 256) return resultPage(c, 'Too many pending authorization requests.', 409);
    pending.set(transaction.state, {...ticket, expires: transaction.expires, verifier: transaction.verifier, session});
    active.set(ticket.connection, transaction.state);
    return c.redirect(transaction.url, 303);
  });
  app.get('/oauth/callback/:name', async (c) => {
    clearExpired();
    const connection = c.req.param('name');
    const state = c.req.query('state');
    const ticket = pending.get(state);
    if (!ticket || ticket.connection !== connection) return resultPage(c, 'Invalid or expired authorization.', 400);
    const session = await options.authorize(c, connection);
    if (!session || session !== ticket.session) return resultPage(c, 'Authorization belongs to another session.', 403);
    if (!pending.delete(state)) return resultPage(c, 'Authorization has already been completed.', 400);
    const current = () => active.get(connection) === state && ticket.current() && ticket.expires > Date.now();
    try {
      const code = c.req.query('code');
      if (c.req.query('error') || !code) return resultPage(c, 'Authorization was declined or failed.', 400);
      const stored = await serialized(connection, async () => {
        if (!current()) return false;
        const grant = await exchangeOAuth(getClient(connection), code, ticket.verifier, ticket.scope);
        if (!current()) return false;
        await writeGrant(connection, grant);
        return true;
      });
      return stored
        ? resultPage(c, 'Authorization saved. You can close this tab.')
        : resultPage(c, 'The authorization target changed. Start a new authorization request.', 409);
    } catch {
      return resultPage(
        c,
        'The OAuth provider could not complete authorization. Start a new authorization request.',
        400
      );
    } finally {
      if (active.get(connection) === state) active.delete(connection);
    }
  });
}
