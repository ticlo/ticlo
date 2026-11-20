import {
  BaseFunction,
  NO_EMIT,
  SubscribeFunction,
  defaultConfigs,
  globalFunctions,
  type LiveEvent,
  type PropDesc,
} from '@ticlo/core';
import {mqttPublishParameters, publish, type MqttService} from './ClientFunction.ts';
import type {MqttTarget} from './MqttClient.ts';

const decoder = new TextDecoder();
const clientProp: PropDesc = {name: 'client', type: 'service', options: ['mqtt-client'], pinned: true};
const filterProp: PropDesc = {name: 'filter', type: 'string', pinned: true};

class MqttSubscribeFunction extends SubscribeFunction<MqttTarget> {
  protected target(): MqttTarget {
    const format = this._data.getValue('format');
    if (format !== undefined && format !== 'bytes' && format !== 'text' && format !== 'json') {
      throw new Error('Invalid MQTT payload format');
    }
    return {filter: this._data.getValue('filter') as string, qos: this._data.getValue('qos') as MqttTarget['qos']};
  }

  protected receive(event: LiveEvent) {
    if (event.type === 'message') {
      const bytes = event.value as Uint8Array;
      const format = this._data.getValue('format');
      const value =
        format === 'json'
          ? JSON.parse(decoder.decode(bytes))
          : format === 'text'
            ? decoder.decode(bytes)
            : bytes.slice();
      this._data.output(event.meta.topic, 'topic');
      this._data.output(event.meta.qos, 'qosReceived');
      this._data.output(event.meta.retain, 'retain');
      this._data.output(event.time, 'receivedAt');
      super.receive({...event, value});
    } else {
      super.receive(event);
    }
  }

  cleanup() {
    super.cleanup();
    this._data.output(undefined, 'topic');
    this._data.output(undefined, 'qosReceived');
    this._data.output(undefined, 'retain');
    this._data.output(undefined, 'receivedAt');
  }
}

class MqttQueryFunction extends BaseFunction {
  run() {
    const client = this._data.getValue('client') as MqttService;
    if (!client) {
      this.cleanup();
      return NO_EMIT;
    }
    if (typeof client.query !== 'function') throw new Error('Invalid MQTT client');
    const limit = (this._data.getValue('limit') ?? 100) as number;
    const cursor = this._data.getValue('cursor') as string | undefined;
    if (
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > 256 ||
      (cursor !== undefined && typeof cursor !== 'string')
    ) {
      throw new Error('Invalid MQTT query page');
    }
    this._data.output(client.query(this._data.getValue('filter'), {limit, cursor}));
  }

  cleanup() {
    this._data.output(undefined);
  }
}

class MqttPublishFunction extends BaseFunction {
  async run() {
    await publish(this._data.getValue('client') as MqttService, {
      topic: this._data.getValue('topic'),
      payload: this._data.getValue('payload'),
      qos: this._data.getValue('qos'),
      retain: this._data.getValue('retain'),
    });
  }
}

globalFunctions.addFactory(
  MqttSubscribeFunction,
  {
    id: 'mqtt:subscribe',
    name: 'subscribe',
    category: 'mqtt',
    mode: 'onLoad',
    priority: 2,
    configs: defaultConfigs.concat('#cancel'),
    properties: [
      clientProp,
      filterProp,
      {name: 'qos', type: 'number', min: 0, max: 2, default: 0},
      {name: 'format', type: 'select', options: ['bytes', 'text', 'json'], default: 'bytes'},
      {name: '#output', type: 'any', readonly: true, pinned: true},
      {name: 'topic', type: 'string', readonly: true},
      {name: 'qosReceived', type: 'number', readonly: true},
      {name: 'retain', type: 'toggle', readonly: true},
      {name: 'receivedAt', type: 'number', readonly: true},
      {name: 'event', type: 'object', readonly: true},
      {name: 'status', type: 'object', readonly: true},
    ],
  },
  'mqtt'
);

globalFunctions.addFactory(
  MqttQueryFunction,
  {
    id: 'mqtt:query',
    name: 'query',
    category: 'mqtt',
    mode: 'onCall',
    priority: 1,
    properties: [
      clientProp,
      filterProp,
      {name: 'limit', type: 'number', min: 1, max: 256, default: 100},
      {name: 'cursor', type: 'string'},
      {name: '#output', type: 'object', readonly: true, pinned: true},
    ],
  },
  'mqtt'
);

globalFunctions.addFactory(
  MqttPublishFunction,
  {
    id: 'mqtt:publish',
    name: 'publish',
    category: 'mqtt',
    mode: 'onCall',
    priority: 3,
    properties: [clientProp, ...mqttPublishParameters],
  },
  'mqtt'
);
