import {once} from 'node:events';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomBytes} from 'node:crypto';
import {serve} from '@hono/node-server';
import {Hono} from 'hono';
import {Root, makeLocalConnection, shouldHappen, type Block, type LiveEvent} from '@ticlo/core';
import {SecretCipher} from '@ticlo/node';
import {createFileOAuthGrantStore, registerOAuth, routeOAuth} from '@ticlo/oauth/node';
import {startOAuthProvider} from '../../../packages/web-server/__spec__/OAuthProvider.ts';
import {MqttClient, type MqttOptions} from '../index.ts';
import {startEmqx} from './localEmqx.ts';

let emqx: Awaited<ReturnType<typeof startEmqx>>;

beforeAll(async () => {
  emqx = await startEmqx();
}, 180_000);

afterAll(async () => {
  await emqx?.close();
});

async function connectStatus(options: MqttOptions) {
  const client = new MqttClient(options);
  let result: LiveEvent;
  client.observeStatus((event) => {
    if (event.type === 'status' && (event.status === 'connected' || event.status === 'error')) result ??= event;
  });
  try {
    return await shouldHappen(() => result, 5000);
  } finally {
    client.close();
  }
}

it('rejects anonymous and invalid JWTs, authorizes via OAuth, and rotates short-lived RS256 JWTs on EMQX', async () => {
  expect(await connectStatus({url: emqx.mqtt, protocolVersion: 5})).toMatchObject({
    status: 'error',
    message: expect.stringMatching(/not authorized|bad user/i),
  });
  expect(
    await connectStatus({url: emqx.mqtt, protocolVersion: 5, username: 'oauth', password: 'invalid.jwt.token'})
  ).toMatchObject({
    status: 'error',
    message: expect.stringMatching(/not authorized|bad user/i),
  });

  registerOAuth();
  const provider = await startOAuthProvider({
    expiresIn: 3,
    allowClientCredentials: true,
    signAccessToken: emqx.signJwt,
  });
  const directory = await mkdtemp(join(tmpdir(), 'ticlo-emqx-oauth-'));
  const root = new Root();
  const app = new Hono();
  const server = serve({fetch: (request) => app.fetch(request), hostname: '127.0.0.1', port: 0});
  const [, writer] = makeLocalConnection(root, false);
  try {
    await once(server, 'listening');
    const {port} = server.address() as {port: number};
    const origin = `http://127.0.0.1:${port}`;
    provider.clients.set('emqx-auth-code', {redirectUri: `${origin}/oauth/callback/emqx`, secret: 'emqx-secret'});
    provider.clients.set('emqx-m2m', {secret: 'm2m-secret'});
    routeOAuth(app, root, {
      origin,
      allowFlowClients: true,
      confirmAuthorization: false,
      store: createFileOAuthGrantStore(directory, new SecretCipher(randomBytes(32))),
      authorize: (c) => (c.req.header('X-Test-Session') === 'alice' ? 'alice' : undefined),
    });

    const flow = root.addFlow('Main', {
      broker: {
        '#is': 'mqtt:client',
        'url': emqx.mqtt,
        'protocolVersion': 5,
        'clientId': 'ticlo-emqx-auth',
        '~auth': {
          '#is': 'auth:oauth',
          'source': 'server',
          'connection': 'emqx',
          'clientId': 'emqx-auth-code',
          'requireClientSecret': true,
          'authorizationUrl': `${provider.origin}/authorize`,
          'tokenUrl': `${provider.origin}/token`,
          'resourceOrigin': emqx.mqtt,
          'scope': 'mqtt',
        },
      },
      sub: {'#is': 'mqtt:subscribe', '~client': '##.broker.#output', 'filter': 'emqx/test', 'format': 'text'},
      pub: {'#is': 'mqtt:publish', '~client': '##.broker.#output', 'topic': 'emqx/test', 'payload': 'jwt-v1', 'qos': 1},

      m2mAuth: {
        '#is': 'auth:oauth',
        'source': 'server',
        'grantType': 'client_credentials',
        'clientId': 'emqx-m2m',
        'tokenUrl': `${provider.origin}/token`,
        'resourceOrigin': emqx.mqtt,
        'scope': 'mqtt',
      },
      m2mBroker: {
        '#is': 'mqtt:client',
        'url': emqx.mqtt,
        'protocolVersion': 5,
        'clientId': 'ticlo-emqx-m2m',
        '~auth': '##.m2mAuth.#output',
      },
      m2mSub: {'#is': 'mqtt:subscribe', '~client': '##.m2mBroker.#output', 'filter': 'emqx/m2m', 'format': 'text'},
      m2mPub: {
        '#is': 'mqtt:publish',
        '~client': '##.m2mBroker.#output',
        'topic': 'emqx/m2m',
        'payload': 'jwt-m2m',
        'qos': 1,
      },
    });
    ((flow.getValue('broker') as Block).getValue('~auth') as Block).setValue('#secret', 'emqx-secret');
    (flow.getValue('m2mAuth') as Block).setValue('#secret', 'm2m-secret');
    root.runAll();

    // M2M client connects directly via client_credentials JWT.
    await shouldHappen(() => (flow.queryValue('m2mBroker.status') as {status: string})?.status === 'connected', 5000);
    await writer.callFunction('Main.m2mPub');
    await shouldHappen(() => flow.queryValue('m2mSub.#output') === 'jwt-m2m', 5000);

    // Interactive auth-code client waits until authorized via forwarded command.
    await shouldHappen(() => (flow.queryValue('broker.status') as {status: string})?.status === 'error');
    const {result} = (await writer.executeCommand('Main.broker', 'startAuthorization')) as {result: {url: string}};
    const start = await app.request(result.url, {
      method: 'POST',
      headers: {'Origin': origin, 'X-Test-Session': 'alice'},
    });
    expect(start.status).toBe(303);
    const allow = new URL(start.headers.get('location'));
    allow.searchParams.set('decision', 'allow');
    const callback = await fetch(allow, {redirect: 'manual'}).then((res) => res.headers.get('location'));
    expect((await app.request(callback, {headers: {'X-Test-Session': 'alice'}})).status).toBe(200);

    // Track gap events so we confirm the new rotated connection is live before publishing jwt-v2.
    let gaps = 0;
    const subEventListener = {
      onChange(value: unknown) {
        if ((value as LiveEvent | undefined)?.type === 'gap') ++gaps;
      },
    };
    flow.queryProperty('sub.event', true)?.listen(subEventListener);
    try {
      await shouldHappen(() => (flow.queryValue('broker.status') as {status: string})?.status === 'connected', 5000);
      await writer.callFunction('Main.pub');
      await shouldHappen(() => flow.queryValue('sub.#output') === 'jwt-v1', 5000);

      // Wait for short-lived 3s JWT to rotate proactively on EMQX without getting stuck disconnected.
      await shouldHappen(() => provider.refreshes >= 1 && gaps >= 1, 6000);
      await shouldHappen(() => (flow.queryValue('broker.status') as {status: string})?.status === 'connected', 5000);
      (flow.getValue('pub') as Block).setValue('payload', 'jwt-v2');
      await writer.callFunction('Main.pub');
      await shouldHappen(() => flow.queryValue('sub.#output') === 'jwt-v2', 5000);
    } finally {
      flow.queryProperty('sub.event', true)?.unlisten(subEventListener);
    }
  } finally {
    writer.destroy();
    root.destroy();
    await Promise.all([
      provider.close(),
      new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
      rm(directory, {recursive: true, force: true}),
    ]);
  }
}, 30_000);
