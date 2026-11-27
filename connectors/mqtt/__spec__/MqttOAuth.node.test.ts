import {once} from 'node:events';
import {createServer, type Socket} from 'node:net';
import {createRequire} from 'node:module';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomBytes} from 'node:crypto';
import {serve} from '@hono/node-server';
import {Hono} from 'hono';
import {Root, globalFunctions, makeLocalConnection, oauthProfiles, shouldHappen, type Block} from '@ticlo/core';
import {SecretCipher} from '@ticlo/node';
import {createFileOAuthGrantStore, registerOAuth, routeOAuth} from '@ticlo/oauth/node';
import {startOAuthProvider} from '../../../packages/web-server/__spec__/OAuthProvider.ts';
import type {Packet} from 'mqtt';
import {MqttClient} from '../index.ts';

const require = createRequire(import.meta.url);
const createBroker: typeof import('aedes').createBroker = require('aedes');
const mqttRequire = createRequire(require.resolve('mqtt'));
const mqttPacket = mqttRequire('mqtt-packet') as {
  parser(opts: {protocolVersion: 5}): NodeJS.EventEmitter & {parse(buf: Buffer): void};
  generate(packet: Record<string, unknown>, opts: {protocolVersion: 5}): Buffer;
};

async function startOAuthAedesBroker(validateToken: (token: string | undefined) => boolean) {
  const attempts: {clientId: string; username: string | undefined; token: string | undefined}[] = [];
  const sockets = new Set<Socket>();
  const broker = createBroker({
    authenticate(client, username, password, done) {
      const token = password?.toString('utf8');
      attempts.push({clientId: client.id, username, token});
      if (validateToken(token)) {
        done(null, true);
      } else {
        const error = Object.assign(new Error('Not authorized'), {returnCode: 5});
        done(error, false);
      }
    },
  });
  const server = createServer((socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    broker.handle(socket);
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const {port} = server.address() as {port: number};
  return {
    url: `mqtt://127.0.0.1:${port}`,
    attempts,
    kickAll() {
      for (const socket of sockets) socket.destroy();
    },
    async close() {
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve) => broker.close(resolve));
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

async function startMqtt5EnhancedBroker(expectedMethod: string, validateToken: (token: string | undefined) => boolean) {
  const attempts: {method: string | undefined; data: string | undefined; username: string | undefined}[] = [];
  const published: {topic: string; payload: string}[] = [];
  const sockets = new Set<Socket>();
  const server = createServer((socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.on('error', () => {});
    const parser = mqttPacket.parser({protocolVersion: 5});
    parser.on('error', () => {});
    parser.on('packet', (packet: Packet) => {
      if (packet.cmd === 'connect') {
        const method = packet.properties?.authenticationMethod;
        const data = packet.properties?.authenticationData
          ? Buffer.from(packet.properties.authenticationData).toString('utf8')
          : undefined;
        attempts.push({method, data, username: packet.username});
        const ok = method === expectedMethod && validateToken(data);
        socket.write(
          mqttPacket.generate(
            {
              cmd: 'connack',
              reasonCode: ok ? 0 : 135,
              sessionPresent: false,
            },
            {protocolVersion: 5}
          )
        );
        if (!ok) socket.end();
      } else if (packet.cmd === 'subscribe') {
        socket.write(
          mqttPacket.generate(
            {
              cmd: 'suback',
              messageId: packet.messageId,
              granted: packet.subscriptions.map((sub) => sub.qos),
            },
            {protocolVersion: 5}
          )
        );
      } else if (packet.cmd === 'publish') {
        const payload = packet.payload.toString('utf8');
        published.push({topic: packet.topic, payload});
        if (packet.qos === 1) {
          socket.write(
            mqttPacket.generate(
              {
                cmd: 'puback',
                messageId: packet.messageId,
                reasonCode: 0,
              },
              {protocolVersion: 5}
            )
          );
        }
        socket.write(
          mqttPacket.generate(
            {
              cmd: 'publish',
              topic: packet.topic,
              payload: packet.payload,
              qos: 0,
              retain: false,
              dup: false,
            },
            {protocolVersion: 5}
          )
        );
      } else if (packet.cmd === 'pingreq') {
        socket.write(mqttPacket.generate({cmd: 'pingresp'}, {protocolVersion: 5}));
      }
    });
    socket.on('data', (chunk) => parser.parse(typeof chunk === 'string' ? Buffer.from(chunk) : chunk));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const {port} = server.address() as {port: number};
  return {
    url: `mqtt://127.0.0.1:${port}`,
    attempts,
    published,
    disconnectAll(reasonCode = 135) {
      for (const socket of sockets) {
        socket.write(mqttPacket.generate({cmd: 'disconnect', reasonCode}, {protocolVersion: 5}));
        socket.end();
      }
    },
    async close() {
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

async function authorizeFlowLink(app: Hono, origin: string, authUrl: string) {
  const start = await app.request(authUrl, {method: 'POST', headers: {'Origin': origin, 'X-Test-Session': 'alice'}});
  expect(start.status).toBe(303);
  const allow = new URL(start.headers.get('location'));
  allow.searchParams.set('decision', 'allow');
  const callback = await fetch(allow, {redirect: 'manual'}).then((res) => res.headers.get('location'));
  expect((await app.request(callback, {headers: {'X-Test-Session': 'alice'}})).status).toBe(200);
}

it('authorizes embedded OAuth on mqtt:client, auto-connects, and refreshes proactively and on rejection', async () => {
  registerOAuth();
  const provider = await startOAuthProvider({expiresIn: 2, allowClientCredentials: true});
  const broker = await startOAuthAedesBroker((token) => Boolean(token && provider.access.has(token)));
  const directory = await mkdtemp(join(tmpdir(), 'ticlo-mqtt-oauth-'));
  const root = new Root();
  const app = new Hono();
  const server = serve({fetch: (request) => app.fetch(request), hostname: '127.0.0.1', port: 0});
  const [, writer] = makeLocalConnection(root, false);
  const [, reader] = makeLocalConnection(root, false, {readonly: true});
  try {
    await once(server, 'listening');
    const {port} = server.address() as {port: number};
    const origin = `http://127.0.0.1:${port}`;
    provider.clients.set('mqtt-client', {redirectUri: `${origin}/oauth/callback/mqtt-conn`, secret: 'mqtt-secret'});
    routeOAuth(app, root, {
      origin,
      allowFlowClients: true,
      confirmAuthorization: false,
      store: createFileOAuthGrantStore(directory, new SecretCipher(randomBytes(32))),
      authorize: (c) => (c.req.header('X-Test-Session') === 'alice' ? 'alice' : undefined),
    });

    const mqttDesc = globalFunctions.getDesc('mqtt:client');
    expect(mqttDesc?.commands?.startAuthorization?.hidden).toBe(true);
    expect(mqttDesc?.commands?.oauthStatus?.hidden).toBe(true);

    const flow = root.addFlow('Main', {
      broker: {
        '#is': 'mqtt:client',
        'url': broker.url,
        'clientId': 'oauth-embed',
        '~auth': {
          '#is': 'auth:oauth',
          'source': 'server',
          'connection': 'mqtt-conn',
          'clientId': 'mqtt-client',
          'requireClientSecret': true,
          'authorizationUrl': `${provider.origin}/authorize`,
          'tokenUrl': `${provider.origin}/token`,
          'resourceOrigin': broker.url,
          'scope': 'mqtt',
        },
      },
      sub: {'#is': 'mqtt:subscribe', '~client': '##.broker.#output', 'filter': 'sensors/#', 'format': 'text'},
      pub: {'#is': 'mqtt:publish', '~client': '##.broker.#output', 'topic': 'sensors/t1', 'payload': 'before-refresh'},
    });
    ((flow.getValue('broker') as Block).getValue('~auth') as Block).setValue('#secret', 'mqtt-secret');
    root.runAll();

    // Waiting for authorization: status reports error, does not connect anonymously.
    await shouldHappen(() => (flow.queryValue('broker.status') as {status: string})?.status === 'error');
    expect(broker.attempts).toHaveLength(0);

    // Embedded command forwarding & readonly enforcement.
    expect(((await reader.executeCommand('Main.broker', 'oauthStatus')) as any).result.status).toBe(
      'authorization-required'
    );
    await expect(reader.executeCommand('Main.broker', 'startAuthorization')).rejects.toBe('readonly');
    const {result} = (await writer.executeCommand('Main.broker', 'startAuthorization')) as {result: {url: string}};
    await authorizeFlowLink(app, origin, result.url);

    // Auto-connects via OAuth observer and serves pub/sub.
    await shouldHappen(() => (flow.queryValue('broker.status') as {status: string})?.status === 'connected', 5000);
    await writer.callFunction('Main.pub');
    await shouldHappen(() => flow.queryValue('sub.#output') === 'before-refresh', 3000);
    const firstToken = broker.attempts[0]?.token;
    expect(firstToken).toBeTruthy();

    // Proactive refresh runs before the 2s expiry and rotates to a new token.
    await shouldHappen(() => provider.refreshes >= 1 && broker.attempts.length >= 2, 5000);
    const rotatedToken = broker.attempts.at(-1)?.token;
    expect(rotatedToken).toBeTruthy();
    expect(rotatedToken).not.toBe(firstToken);
    await shouldHappen(() => (flow.queryValue('broker.status') as {status: string})?.status === 'connected', 5000);

    (flow.getValue('pub') as Block).setValue('payload', 'after-refresh');
    await writer.callFunction('Main.pub');
    await shouldHappen(() => flow.queryValue('sub.#output') === 'after-refresh', 3000);

    // Broker-side token revocation triggers a single forceRefresh recovery.
    const refreshesBeforeRevoke = provider.refreshes;
    provider.revokeAccess(rotatedToken);
    broker.kickAll();
    await shouldHappen(() => provider.refreshes >= refreshesBeforeRevoke + 1, 5000);
    await shouldHappen(() => (flow.queryValue('broker.status') as {status: string})?.status === 'connected', 5000);
    const recoveredToken = broker.attempts.at(-1)?.token;
    expect(recoveredToken).toBeTruthy();
    expect(recoveredToken).not.toBe(rotatedToken);

    // If refresh token is also revoked, client falls back to error / authorization-required and stops retrying.
    provider.revokeAccess(recoveredToken);
    provider.revokeAllRefresh();
    const refreshesBeforeTotalRevoke = provider.refreshes;
    broker.kickAll();
    await shouldHappen(() => flow.queryValue('broker.~auth.status') === 'authorization-required', 5000);
    await shouldHappen(() => (flow.queryValue('broker.status') as {status: string})?.status === 'error', 5000);
    const attemptsAtPause = broker.attempts.length;
    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(provider.refreshes).toBe(refreshesBeforeTotalRevoke);
    expect(broker.attempts.length).toBe(attemptsAtPause);

    // Re-authorizing wakes the waiting client and reconnects cleanly.
    const secondAuth = (await writer.executeCommand('Main.broker', 'startAuthorization')) as {result: {url: string}};
    await authorizeFlowLink(app, origin, secondAuth.result.url);
    await shouldHappen(() => (flow.queryValue('broker.status') as {status: string})?.status === 'connected', 5000);
  } finally {
    writer.destroy();
    reader.destroy();
    root.destroy();
    await Promise.all([
      broker.close(),
      provider.close(),
      new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
      rm(directory, {recursive: true, force: true}),
    ]);
  }
}, 20_000);

it('supports standalone client_credentials, MQTT 5 Enhanced Authentication, and strict unready/origin checks', async () => {
  registerOAuth();
  const provider = await startOAuthProvider({expiresIn: 2, allowClientCredentials: true});
  const aedesBroker = await startOAuthAedesBroker((token) => Boolean(token && provider.access.has(token)));
  const mqtt5Broker = await startMqtt5EnhancedBroker('OAUTH2', (token) => Boolean(token && provider.access.has(token)));
  const root = new Root();
  const [, writer] = makeLocalConnection(root, false);
  try {
    provider.clients.set('m2m-client', {secret: 'm2m-secret'});

    // Priority guarantees auth:* (0) executes before mqtt:client (2).
    expect(globalFunctions.getDesc('auth:oauth')?.priority).toBe(0);
    expect(globalFunctions.getDesc('auth:password')?.priority).toBe(0);
    expect(globalFunctions.getDesc('mqtt:client')?.priority).toBe(2);

    const flow = root.addFlow('Main', {
      // Headless client_credentials (no routeOAuth required) connecting to Aedes.
      m2mAuth: {
        '#is': 'auth:oauth',
        'source': 'server',
        'grantType': 'client_credentials',
        'clientId': 'm2m-client',
        'tokenUrl': `${provider.origin}/token`,
        'resourceOrigin': aedesBroker.url,
        'scope': 'mqtt',
      },
      m2mBroker: {
        '#is': 'mqtt:client',
        'url': aedesBroker.url,
        'clientId': 'm2m-aedes',
        '~auth': '##.m2mAuth.#output',
      },
      m2mSub: {'#is': 'mqtt:subscribe', '~client': '##.m2mBroker.#output', 'filter': 'm2m/#', 'format': 'text'},
      m2mPub: {'#is': 'mqtt:publish', '~client': '##.m2mBroker.#output', 'topic': 'm2m/ping', 'payload': 'pong'},

      // MQTT 5 Enhanced Authentication against custom mqtt-packet broker.
      mqtt5Auth: {
        '#is': 'auth:oauth',
        'source': 'server',
        'grantType': 'client_credentials',
        'clientId': 'm2m-client',
        'tokenUrl': `${provider.origin}/token`,
        'resourceOrigin': mqtt5Broker.url,
        'scope': 'mqtt',
      },
      mqtt5Broker: {
        '#is': 'mqtt:client',
        'url': mqtt5Broker.url,
        'protocolVersion': 5,
        'authMethod': 'OAUTH2',
        'clientId': 'm2m-v5',
        '~auth': '##.mqtt5Auth.#output',
      },
      mqtt5Sub: {'#is': 'mqtt:subscribe', '~client': '##.mqtt5Broker.#output', 'filter': 'v5/#', 'format': 'text'},
      mqtt5Pub: {'#is': 'mqtt:publish', '~client': '##.mqtt5Broker.#output', 'topic': 'v5/test', 'payload': 'enhanced'},

      // Unready auth (missing #secret) blocks client execution.
      unreadyAuth: {
        '#is': 'auth:oauth',
        'source': 'server',
        'grantType': 'client_credentials',
        'clientId': 'm2m-client',
        'tokenUrl': `${provider.origin}/token`,
        'resourceOrigin': aedesBroker.url,
        'scope': 'mqtt',
      },
      blockedBroker: {
        '#is': 'mqtt:client',
        'url': aedesBroker.url,
        'clientId': 'blocked',
        '~auth': '##.unreadyAuth.#output',
      },

      // Resource origin mismatch is rejected.
      mismatchBroker: {
        '#is': 'mqtt:client',
        'url': 'mqtt://localhost:1883',
        'clientId': 'mismatch',
        '~auth': '##.m2mAuth.#output',
      },

      // Unbound / missing auth profile remains anonymous.
      anonBroker: {
        '#is': 'mqtt:client',
        'url': aedesBroker.url,
        'clientId': 'anon',
        '~auth': '##.missingAuth.#output',
      },
    });
    (flow.getValue('m2mAuth') as Block).setValue('#secret', 'm2m-secret');
    (flow.getValue('mqtt5Auth') as Block).setValue('#secret', 'm2m-secret');
    root.runAll();

    // Verify unready auth state blocks client without outputting a service.
    const unreadyProfile = flow.queryValue('unreadyAuth.#output') as object;
    expect(oauthProfiles.get(unreadyProfile)?.ready).toBe(false);
    expect(flow.queryValue('blockedBroker.#output')).toBeUndefined();
    expect(flow.queryValue('blockedBroker.status')).toMatchObject({status: 'error'});
    expect(flow.queryValue('mismatchBroker.#output')).toBeUndefined();
    expect(flow.queryValue('anonBroker.#output')).toBeDefined();

    // Aedes anonymous connection is rejected by broker while m2m and mqtt5 connect.
    await shouldHappen(() => (flow.queryValue('m2mBroker.status') as {status: string})?.status === 'connected', 5000);
    await shouldHappen(() => (flow.queryValue('mqtt5Broker.status') as {status: string})?.status === 'connected', 5000);
    expect(flow.queryValue('m2mAuth.status')).toBe('authorized');
    expect(mqtt5Broker.attempts[0]).toMatchObject({method: 'OAUTH2'});
    expect(mqtt5Broker.attempts[0].data).toBeTruthy();

    await writer.callFunction('Main.m2mPub');
    await shouldHappen(() => flow.queryValue('m2mSub.#output') === 'pong', 3000);

    await writer.callFunction('Main.mqtt5Pub');
    await shouldHappen(() => flow.queryValue('mqtt5Sub.#output') === 'enhanced', 3000);

    // Standalone client_credentials rotates proactively before the 2s expiry.
    const initialM2mToken = aedesBroker.attempts.find((attempt) => attempt.clientId === 'm2m-aedes')?.token;
    await shouldHappen(
      () => aedesBroker.attempts.filter((attempt) => attempt.clientId === 'm2m-aedes').length >= 2,
      5000
    );
    const rotatedM2mToken = aedesBroker.attempts.filter((attempt) => attempt.clientId === 'm2m-aedes').at(-1)?.token;
    expect(rotatedM2mToken).toBeTruthy();
    expect(rotatedM2mToken).not.toBe(initialM2mToken);

    // MQTT 5 DISCONNECT 135 forces a refresh and reconnects with a new token.
    await shouldHappen(() => (flow.queryValue('mqtt5Broker.status') as {status: string})?.status === 'connected', 5000);
    const v5CountBefore = mqtt5Broker.attempts.length;
    const oldV5Token = mqtt5Broker.attempts.at(-1)?.data;
    mqtt5Broker.disconnectAll(135);
    await shouldHappen(() => mqtt5Broker.attempts.length > v5CountBefore, 5000);
    await shouldHappen(() => (flow.queryValue('mqtt5Broker.status') as {status: string})?.status === 'connected', 5000);
    expect(mqtt5Broker.attempts.at(-1)?.data).not.toBe(oldV5Token);

    // Direct MqttClient validation checks.
    expect(
      () =>
        new MqttClient({
          url: 'mqtt://broker.example.test',
          oauth: oauthProfiles.get(flow.queryValue('m2mAuth.#output') as object),
        })
    ).toThrow('TLS on non-loopback');
    expect(
      () =>
        new MqttClient({
          url: mqtt5Broker.url,
          protocolVersion: 4,
          authMethod: 'OAUTH2',
          oauth: oauthProfiles.get(flow.queryValue('mqtt5Auth.#output') as object),
        })
    ).toThrow('protocolVersion 5');
    expect(
      () =>
        new MqttClient({
          url: mqtt5Broker.url,
          oauth: {
            ready: true,
            origin: mqtt5Broker.url,
            requiresContext: true,
            async token() {
              return {accessToken: 'x', expiresAt: Date.now() + 1000};
            },
          },
        })
    ).toThrow('currentUser');
  } finally {
    writer.destroy();
    root.destroy();
    await Promise.all([aedesBroker.close(), mqtt5Broker.close(), provider.close()]);
  }
}, 20_000);
