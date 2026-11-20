import {encode, Root, shouldHappen, type LiveEvent} from '@ticlo/core';
import {MqttClient, type MqttOptions} from '../index.ts';
import {mosquittoPassword, startMosquitto} from './localMosquitto.ts';

let broker: Awaited<ReturnType<typeof startMosquitto>>;

beforeAll(async () => {
  broker = await startMosquitto();
}, 130_000);

afterAll(async () => {
  await broker?.close();
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

it('connects anonymously to a plaintext MQTT 5 listener', async () => {
  expect(await connectStatus({url: broker.mqtt, protocolVersion: 5})).toMatchObject({status: 'connected'});
});

it('verifies credentials over WSS', async () => {
  const options = {url: broker.wss, ca: broker.ca, username: 'ticlo'};
  expect(await connectStatus({...options, password: mosquittoPassword})).toMatchObject({status: 'connected'});
  expect(await connectStatus({...options, password: 'wrong-password'})).toMatchObject({
    status: 'error',
    message: expect.stringMatching(/not authorized|bad user/i),
  });
  expect(await connectStatus({url: broker.wss, ca: broker.ca})).toMatchObject({
    status: 'error',
    message: expect.stringMatching(/not authorized|bad user/i),
  });
  expect(await connectStatus({url: broker.wss, username: 'ticlo', password: mosquittoPassword})).toMatchObject({
    status: 'error',
    message: expect.stringMatching(/certificate/i),
  });
});

it('uses a host-owned client certificate through an MQTT Block binding', async () => {
  const root = new Root();
  try {
    root.defineGlobal('clientIdentity', {'#is': '', '#output': broker.tlsClientIdentity});
    const flow = root.addFlow('Main', {
      broker: {
        '#is': 'mqtt:client',
        'url': broker.mqtts,
        'ca': broker.ca,
        '~tlsClientIdentity': '^clientIdentity.#output',
      },
    });
    root.runAll();
    await shouldHappen(() => (flow.queryValue('broker.status') as {status: string})?.status === 'connected', 5000);
    expect(encode(flow.queryValue('broker.tlsClientIdentity'))).toContain('tls-client-identity');
    expect(encode(flow.queryValue('broker.tlsClientIdentity'))).not.toContain('PRIVATE KEY');
    expect(() => new MqttClient({url: broker.mqtt, tlsClientIdentity: broker.tlsClientIdentity})).toThrow(
      'requires TLS'
    );
    expect(await connectStatus({url: broker.mqtts, ca: broker.ca})).toMatchObject({status: 'error'});
  } finally {
    root.destroy();
  }
});
