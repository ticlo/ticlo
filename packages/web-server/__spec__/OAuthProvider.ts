import {once} from 'node:events';
import {createHash, randomUUID} from 'node:crypto';
import {serve} from '@hono/node-server';
import {Hono} from 'hono';
import {cors} from 'hono/cors';

export async function startOAuthProvider() {
  const app = new Hono();
  const clients = new Map<string, {redirectUri: string; secret?: string}>();
  const codes = new Map<string, {clientId: string; challenge: string; scope: string}>();
  const access = new Map<string, {user: string; scope: string}>();
  const refresh = new Map<string, {user: string; scope: string}>();
  let refreshes = 0;
  app.use('*', cors({allowHeaders: ['Content-Type', 'Authorization']}));
  app.get('/authorize', (c) => {
    const clientId = c.req.query('client_id');
    const client = clients.get(clientId);
    if (
      !client ||
      client.redirectUri !== c.req.query('redirect_uri') ||
      c.req.query('code_challenge_method') !== 'S256'
    ) {
      return c.text('Invalid client registration', 400);
    }
    const callback = new URL(client.redirectUri);
    callback.searchParams.set('state', c.req.query('state'));
    if (c.req.query('decision') === 'deny') {
      callback.searchParams.set('error', 'access_denied');
      return c.redirect(callback.href);
    }
    if (c.req.query('decision') !== 'allow') {
      return c.html(
        '<!doctype html><button value="allow">Allow</button><button value="deny">Deny</button>' +
          '<script>document.querySelectorAll("button").forEach(button => button.onclick = () => {' +
          'const url = new URL(location.href); url.searchParams.set("decision", button.value); location.href = url.href;});</script>'
      );
    }
    const code = randomUUID();
    codes.set(code, {clientId, challenge: c.req.query('code_challenge'), scope: c.req.query('scope')});
    callback.searchParams.set('code', code);
    return c.redirect(callback.href);
  });
  app.post('/token', async (c) => {
    const values = await c.req.parseBody();
    const authorization = c.req.header('Authorization');
    const [id, secret] = authorization?.startsWith('Basic ')
      ? Buffer.from(authorization.slice(6), 'base64').toString().split(':')
      : [String(values.client_id), undefined];
    const client = clients.get(id);
    if (!client || client.secret !== secret) return c.json({error: 'invalid_client'}, 401);
    let grant: {user: string; scope: string};
    if (values.grant_type === 'authorization_code') {
      const code = String(values.code);
      const transaction = codes.get(code);
      const challenge = createHash('sha256').update(String(values.code_verifier)).digest('base64url');
      if (
        transaction?.clientId !== id ||
        challenge !== transaction.challenge ||
        client.redirectUri !== values.redirect_uri
      ) {
        return c.json({error: 'invalid_grant'}, 400);
      }
      codes.delete(code);
      grant = {user: id, scope: transaction.scope};
    } else {
      const key = String(values.refresh_token);
      grant = refresh.get(key);
      if (!grant || grant.user !== id || !refresh.delete(key)) return c.json({error: 'invalid_grant'}, 400);
      ++refreshes;
    }
    const accessToken = randomUUID();
    const refreshToken = randomUUID();
    access.set(accessToken, grant);
    refresh.set(refreshToken, grant);
    return c.json({
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'Bearer',
      expires_in: 3600,
      scope: grant.scope,
    });
  });
  app.get('/resource', (c) => {
    const grant = access.get(c.req.header('Authorization')?.slice('Bearer '.length));
    if (!grant || !grant.scope.split(' ').includes('read')) return c.json({error: 'Unauthorized'}, 401);
    return c.json({user: grant.user});
  });
  app.get('/redirect', (c) => c.redirect('/resource'));
  const server = serve({fetch: app.fetch, hostname: '127.0.0.1', port: 0});
  await once(server, 'listening');
  const address = server.address();
  if (typeof address !== 'object' || !address) throw new Error('Missing OAuth provider address');
  return {
    origin: `http://127.0.0.1:${address.port}`,
    clients,
    access,
    get refreshes() {
      return refreshes;
    },
    close: () => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}
