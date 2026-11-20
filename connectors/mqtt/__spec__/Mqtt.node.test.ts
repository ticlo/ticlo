import {once} from 'node:events';
import {createServer, type Socket} from 'node:net';
import {createRequire} from 'node:module';
import {Root, makeLocalConnection, shouldHappen, type Block, type LiveUpdate} from '@ticlo/core';
import '../index.ts';

const createBroker: typeof import('aedes').createBroker = createRequire(import.meta.url)('aedes');

it('sends local credentials only when auth is a password profile', async () => {
  const attempts = new Map<string, {username: string | undefined; password: string | undefined}>();
  const broker = createBroker({
    authenticate(client, username, password, done) {
      attempts.set(client.id, {username, password: password?.toString()});
      done(null, true);
    },
  });
  const socket = createServer(broker.handle);
  socket.listen(0, '127.0.0.1');
  await once(socket, 'listening');
  const url = 'mqtt://127.0.0.1:' + (socket.address() as {port: number}).port;
  const root = new Root();
  try {
    const flow = root.addFlow('Main', {
      helper: {'#is': 'mqtt:client', url, 'clientId': 'helper', 'username': 'local', '~auth': {'#is': 'auth:password'}},
      context: {
        '#is': 'mqtt:client',
        url,
        'clientId': 'context',
        'username': 'context-user',
        '~auth': '^login.#output',
      },
      nullAuth: {'#is': 'mqtt:client', url, 'clientId': 'nullAuth', 'username': 'old', 'auth': null},
      unsetAuth: {'#is': 'mqtt:client', url, 'clientId': 'unsetAuth', 'username': 'old'},
    });
    for (const name of ['helper', 'context', 'nullAuth', 'unsetAuth']) {
      (flow.getValue(name) as Block).setValue('#secret', name + '-password');
    }
    root.runAll();
    await shouldHappen(() => attempts.size === 4, 2000);
    expect(attempts).toEqual(
      new Map([
        ['helper', {username: 'local', password: 'helper-password'}],
        ['context', {username: undefined, password: undefined}],
        ['nullAuth', {username: undefined, password: undefined}],
        ['unsetAuth', {username: undefined, password: undefined}],
      ])
    );
    expect(flow.queryValue('helper.auth')).toEqual({authMode: 'password', showSecret: true});
    expect(flow.queryValue('helper.#secret')).toBeUndefined();

    root._globalRoot.createBlock('^login').setValue('#is', 'auth:password');
    root.runAll();
    await shouldHappen(() => attempts.get('context')?.username === 'context-user', 2000);
    expect(attempts.get('context')).toEqual({
      username: 'context-user',
      password: 'context-password',
    });
  } finally {
    root.destroy();
    await new Promise<void>((resolve) => broker.close(resolve));
    await new Promise<void>((resolve) => socket.close(() => resolve()));
  }
});

it('runs MQTT Blocks and shares broker subscriptions with a readonly live explorer', async () => {
  const broker = createBroker();
  const socket = createServer(broker.handle);
  let peer: Socket;
  socket.on('connection', (connection) => {
    peer = connection;
  });
  socket.listen(0, '127.0.0.1');
  await once(socket, 'listening');
  const port = (socket.address() as {port: number}).port;
  const root = new Root();
  const flow = root.addFlow('Main', {
    broker: {'#is': 'mqtt:client', 'url': 'mqtt://127.0.0.1:' + port, 'clientId': 'ticlo-test'},
    input: {'#is': 'mqtt:subscribe', '~client': '##.broker.#output', 'filter': 'plant/temperature', 'format': 'json'},
    query: {'#is': 'mqtt:query', '~client': '##.broker.#output', 'filter': 'plant/#'},
    publish: {
      '#is': 'mqtt:publish',
      '~client': '##.broker.#output',
      'topic': 'plant/temperature',
      'payload': {value: 22},
      'qos': 1,
    },
  });
  const [, writer] = makeLocalConnection(root, false);
  const [server, reader] = makeLocalConnection(root, false, {readonly: true});
  const subscriptions: string[] = [];
  const unsubscriptions: string[] = [];
  broker.on('subscribe', (topics) => subscriptions.push(...topics.map(({topic}) => topic)));
  broker.on('unsubscribe', (topics) => unsubscriptions.push(...topics));
  const path = 'Main.broker';
  const updates: LiveUpdate[] = [];
  const onError = vi.fn();
  try {
    root.runAll();
    await shouldHappen(() => subscriptions.includes('plant/temperature'));
    expect((await reader.getLiveCapabilities(path)).capabilities).toMatchObject({tree: true, liveRows: true});
    expect((await reader.getLiveCapabilities(path)).capabilities.publish).toBeUndefined();
    const watch = reader.watchLive(
      path,
      {targets: ['plant/temperature']},
      (messages) => updates.push(...messages),
      onError
    );
    await shouldHappen(() => updates.some(({target}) => target === 'plant/temperature'));
    expect(subscriptions).toEqual(['plant/temperature']);
    await writer.callFunction('Main.publish');
    await shouldHappen(() => flow.queryValue('input.topic') === 'plant/temperature');
    expect(flow.queryValue('input.#output')).toEqual({value: 22});
    await shouldHappen(() => updates.some(({event}) => 'value' in event && event.value === '{"value":22}'));
    await expect(reader.executeCommand(path, 'publish', {topic: 'plant/temperature', payload: 99})).rejects.toBe(
      'readonly'
    );
    await writer.callFunction('Main.query');
    expect(await shouldHappen(() => flow.queryValue('query.#output'))).toMatchObject({
      rows: [{target: 'plant/temperature', preview: '{"value":22}'}],
    });
    expect((await reader.listLiveChildren(path, undefined, {limit: 100})).rows).toEqual([
      {id: 'plant', branch: 'plant', label: 'plant'},
    ]);
    expect((await reader.searchLive(path, {filter: 'plant/+'}, {limit: 10})).rows).toHaveLength(1);

    reader.cancel(watch);
    await shouldHappen(() => Object.keys(server.requests).length === 0);
    expect(unsubscriptions).toEqual([]);
    const input = flow.queryValue('input') as Block;
    input.setValue('filter', 'plant/humidity');
    await shouldHappen(() => unsubscriptions.includes('plant/temperature') && subscriptions.includes('plant/humidity'));

    await writer.executeCommand(path, 'publish', {topic: 'plant/retained', payload: 'retained', qos: 1, retain: true});
    expect((await reader.searchLive(path, {filter: 'plant/retained'}, {limit: 10})).rows).toEqual([]);
    const sample = reader.watchLive(
      path,
      {capture: {filter: 'plant/#'}},
      (messages) => updates.push(...messages),
      onError
    );
    await shouldHappen(() => updates.some(({event}) => 'value' in event && event.value === 'retained'));
    expect((await reader.searchLive(path, {filter: 'plant/retained'}, {limit: 10})).rows).toHaveLength(1);
    reader.cancel(sample);
    await shouldHappen(() => unsubscriptions.includes('plant/#'));
    const follow = reader.watchLive(
      path,
      {capture: {filter: 'plant/humidity'}, follow: true},
      (messages) => updates.push(...messages),
      onError
    );
    await shouldHappen(() => Object.keys(server.requests).length === 1);
    peer.destroy();
    await shouldHappen(() => subscriptions.filter((topic) => topic === 'plant/humidity').length === 2, 5000);
    await shouldHappen(() => updates.some(({event}) => event.type === 'gap'));
    expect(subscriptions.filter((topic) => topic === 'plant/#')).toHaveLength(1);
    reader.cancel(follow);
    await shouldHappen(() => Object.keys(server.requests).length === 0);
    await writer.executeCommand(path, 'publish', {topic: 'plant/humidity', payload: {value: 55}, qos: 1});
    await shouldHappen(() => (flow.queryValue('input.#output') as {value: number})?.value === 55);
    expect(onError).not.toHaveBeenCalled();
  } finally {
    reader.destroy();
    writer.destroy();
    root.destroy();
    await new Promise<void>((resolve) => broker.close(resolve));
    await new Promise<void>((resolve) => socket.close(() => resolve()));
  }
});
