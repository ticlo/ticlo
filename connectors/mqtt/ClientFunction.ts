import {
  BaseFunction,
  configDescs,
  escapedObject,
  globalFunctions,
  NO_EMIT,
  resolvePasswordAuth,
  type Block,
  type BlockConfig,
  type FunctionApi,
  type LiveSubscription,
  type TlsClientIdentity,
} from '@ticlo/core';
import {MqttClient, publishCommand, type MqttOptions} from './MqttClient.ts';

class MqttClientFunction extends BaseFunction<Block> {
  private client?: MqttClient;
  private status?: LiveSubscription;
  #getSecret: () => string | undefined;

  initInputs(getSecret: () => string | undefined) {
    this.#getSecret = getSecret;
  }

  configChanged(config: BlockConfig) {
    return config.getName() === '#secret';
  }

  run() {
    this.cleanup();
    const url = this._data.getValue('url') as string;
    if (!url) return NO_EMIT;
    const password = resolvePasswordAuth(this._data.getValue('auth'), this.#getSecret);
    let username: string | undefined;
    if (password !== undefined) {
      const user = this._data.getValue('username');
      if (typeof user !== 'string') throw new Error('MQTT password authentication requires username');
      username = user;
    }

    const client = (this.client = new MqttClient({
      url,
      password,
      username,
      clientId: this._data.getValue('clientId') as string,
      protocolVersion: this._data.getValue('protocolVersion') as MqttOptions['protocolVersion'],
      keepalive: this._data.getValue('keepalive') as number,
      ca: this._data.getValue('ca') as string,
      tlsClientIdentity: this._data.getValue('tlsClientIdentity') as TlsClientIdentity,
    }));
    this.status = client.observeStatus((status) => this._data.output(status, 'status'));
    this._data.output(
      escapedObject('mqtt:client', {
        subscribe: client.subscribe.bind(client),
        query: client.query.bind(client),
        publish: client.publish.bind(client),
        liveExplorer: client.liveExplorer,
      })
    );
    return NO_EMIT;
  }

  private release() {
    this.status?.close();
    this.status = undefined;
    this.client?.close();
    this.client = undefined;
  }

  cleanup() {
    this.release();
    this._data.output(undefined);
    this._data.output(undefined, 'status');
  }

  destroy() {
    this.release();
    super.destroy();
  }
}

export interface MqttService {
  subscribe: MqttClient['subscribe'];
  query: MqttClient['query'];
  publish: MqttClient['publish'];
  liveExplorer: MqttClient['liveExplorer'];
}

export const mqttPublishParameters = publishCommand.parameters;

export function publish(client: MqttService, {topic, payload, qos, retain}: Record<string, unknown>) {
  if (typeof client?.publish !== 'function') throw new Error('MQTT client is not ready');
  return client.publish(topic as string, payload, qos as 0 | 1 | 2, retain as boolean);
}

const api: FunctionApi = {
  commands: {
    publish(block, params, readonly) {
      if (readonly) throw new Error('readonly');
      return publish(block.getValue('#output') as MqttService, params);
    },
  },
};

globalFunctions.addCategory({id: 'mqtt:mqtt', name: 'MQTT', libraryId: 'mqtt', icon: '13:MQ'});

globalFunctions.addFactory(
  MqttClientFunction,
  {
    id: 'mqtt:client',
    name: 'client',
    category: 'mqtt',
    mode: 'onLoad',
    priority: 2,
    tags: ['mqtt-client', 'live-client', 'context-service'],
    commands: {publish: publishCommand},
    properties: [
      {name: 'url', type: 'string', pinned: true},
      {name: 'auth', type: 'object', create: ['auth:password'], disableObjectTools: true},
      {name: 'username', type: 'string'},
      configDescs['#secret'],
      {name: 'clientId', type: 'string'},
      {name: 'protocolVersion', type: 'select', options: [4, 5], default: 4},
      {name: 'keepalive', type: 'number', min: 0, max: 65535, default: 60, unit: 's'},
      {name: 'ca', type: 'string'},
      {name: 'tlsClientIdentity', type: 'object'},
      {name: '#output', type: 'object', readonly: true, pinned: true},
      {name: 'status', type: 'object', readonly: true},
    ],
  },
  'mqtt',
  api
);
