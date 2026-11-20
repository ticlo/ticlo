import {connect, type MqttClient as WireClient} from 'mqtt';
import {
  Logger,
  type DataMap,
  type FunctionCommandDesc,
  type LiveEvent,
  type LiveExplorer,
  type LiveObserver,
  type LivePageRequest,
  type LiveSource,
  type TlsClientIdentity,
} from '@ticlo/core';
import {getTlsClientIdentity} from '@ticlo/core/functions/auth/TlsClientIdentity.ts';
import {TopicIndex, topicFilter, validateTopic} from './Topics.ts';

type QoS = 0 | 1 | 2;

export const publishCommand: FunctionCommandDesc = {
  hidden: true,
  parameters: [
    {name: 'topic', type: 'string'},
    {name: 'payload', type: 'any'},
    {name: 'qos', type: 'number', min: 0, max: 2, default: 0},
    {name: 'retain', type: 'toggle', default: false},
  ],
};

export interface MqttOptions {
  url: string;
  username?: string;
  password?: string;
  clientId?: string;
  protocolVersion?: 4 | 5;
  keepalive?: number;
  ca?: string;
  tlsClientIdentity?: TlsClientIdentity;
}

export interface MqttTarget {
  filter: string;
  qos?: QoS;
}

interface Filter {
  match: (topic: string, levels?: string[]) => boolean;
  listeners: Map<LiveObserver, QoS>;
}

function asQos(value: unknown): QoS {
  if (value === undefined) return 0;
  if (value === 0 || value === 1 || value === 2) return value;
  throw new Error('Invalid MQTT QoS');
}

function payloadPreview(payload: Buffer) {
  const head = payload.subarray(0, 160);
  const text = head.toString('utf8');
  const preview = /[\u0000-\u0008\u000e-\u001f]/.test(text) ? '0x' + head.toString('hex') : text;
  return payload.length > head.length ? preview + '…' : preview;
}

function validateQueryFilter(filter: unknown) {
  if (filter !== undefined && typeof filter !== 'string') throw new Error('Invalid MQTT filter');
  return (filter ?? '') as string;
}

export class MqttClient implements LiveSource<MqttTarget> {
  private wire: WireClient;
  private filters = new Map<string, Filter>();
  private wildcardFilters = new Set<Filter>();
  private sent = new Map<string, QoS>();
  private pending = new Set<string>();
  private statusObservers = new Set<LiveObserver>();
  private index = new TopicIndex();
  private epoch = 0;
  private closed = false;
  private connectedOnce = false;
  private status: LiveEvent = {type: 'status', status: 'connecting'};

  constructor({
    url,
    username,
    password,
    clientId,
    protocolVersion = 4,
    keepalive = 60,
    ca,
    tlsClientIdentity,
  }: MqttOptions) {
    const address = URL.parse(url);
    if (
      !address?.hostname ||
      !['mqtt:', 'mqtts:', 'ws:', 'wss:'].includes(address.protocol) ||
      address.username ||
      address.password ||
      address.hash
    ) {
      throw new Error('Invalid MQTT broker URL. Configure credentials separately.');
    }
    if (protocolVersion !== 4 && protocolVersion !== 5) throw new Error('Invalid MQTT protocol version');
    if (!Number.isInteger(keepalive) || keepalive < 0 || keepalive > 65535) throw new Error('Invalid MQTT keepalive');
    if (tlsClientIdentity != null && address.protocol !== 'mqtts:' && address.protocol !== 'wss:') {
      throw new Error('MQTT client identity requires TLS');
    }
    const wire = (this.wire = connect(address.href, {
      ...(tlsClientIdentity == null ? undefined : getTlsClientIdentity(tlsClientIdentity)),
      protocolVersion,
      username,
      password,
      clientId,
      keepalive,
      ca,
      rejectUnauthorized: true,
      clean: true,
      resubscribe: false,
      queueQoSZero: false,
    }));
    wire.on('connect', () => {
      this.setStatus({type: 'status', status: 'connected'});
      if (this.connectedOnce) this.notify({type: 'gap'});
      this.connectedOnce = true;
      for (const filter of this.filters.keys()) this.syncFilter(filter);
    });
    wire.on('reconnect', () => this.setStatus({type: 'status', status: 'connecting'}));
    wire.on('close', () => {
      ++this.epoch;
      this.sent.clear();
      this.pending.clear();
      if (!this.closed) this.setStatus({type: 'status', status: 'disconnected'});
    });
    wire.on('error', (error) => this.setStatus({type: 'status', status: 'error', message: error.message}));
    wire.on('message', (topic, payload, packet) => {
      const exact = this.filters.get(topic);
      const matching = exact ? [exact] : [];
      const levels = this.wildcardFilters.size ? topic.split('/') : undefined;
      for (const filter of this.wildcardFilters) {
        if (filter.match(topic, levels)) matching.push(filter);
      }
      if (!matching.length) return;
      const time = Date.now();
      const preview = payloadPreview(payload);
      this.index.observe(topic, preview, time);
      const event: LiveEvent = {
        type: 'message',
        time,
        value: new Uint8Array(payload.buffer, payload.byteOffset, payload.byteLength),
        meta: {topic, qos: packet.qos, retain: packet.retain, preview},
      };
      for (const {listeners} of matching) for (const listener of listeners.keys()) listener(event);
    });
  }

  private setStatus(event: LiveEvent) {
    this.status = event;
    for (const observer of this.statusObservers) observer(event);
    this.notify(event);
  }

  private notify(event: LiveEvent) {
    for (const filter of this.filters.values()) {
      for (const observer of filter.listeners.keys()) observer(event);
    }
  }

  observeStatus(observer: LiveObserver) {
    this.statusObservers.add(observer);
    observer(this.status);
    return {close: () => this.statusObservers.delete(observer)};
  }

  subscribe({filter, qos}: MqttTarget, observer: LiveObserver) {
    if (this.closed) throw new Error('MQTT client is closed');
    const level = asQos(qos);
    let entry = this.filters.get(filter);
    if (!entry) {
      entry = {match: topicFilter(filter), listeners: new Map()};
      this.filters.set(filter, entry);
      if (/[+#]/.test(filter)) this.wildcardFilters.add(entry);
    }
    // Each handle is independent even when callers reuse a callback.
    const listener: LiveObserver = (event) => {
      try {
        observer(event);
      } catch (error) {
        Logger.warn('MQTT message handler failed', error);
      }
    };
    entry.listeners.set(listener, level);
    listener(this.status);
    this.syncFilter(filter);
    return {
      close: () => {
        if (!entry.listeners.delete(listener)) return;
        if (!entry.listeners.size) {
          this.filters.delete(filter);
          this.wildcardFilters.delete(entry);
        }
        this.syncFilter(filter);
      },
    };
  }

  private syncFilter(filter: string) {
    if (!this.wire.connected || this.closed || this.pending.has(filter)) return;
    const entry = this.filters.get(filter);
    let desired: QoS | undefined;
    if (entry) {
      desired = 0;
      for (const qos of entry.listeners.values()) if (qos > desired) desired = qos;
    }
    if (this.sent.get(filter) === desired) return;
    const epoch = this.epoch;
    this.pending.add(filter);
    const complete = (error?: Error) => {
      if (epoch !== this.epoch || this.closed) return;
      this.pending.delete(filter);
      if (error) {
        for (const listener of this.filters.get(filter)?.listeners.keys() ?? []) {
          listener({type: 'status', status: 'error', message: error.message});
        }
      } else {
        if (desired === undefined) this.sent.delete(filter);
        else this.sent.set(filter, desired);
        this.syncFilter(filter);
      }
    };
    if (desired === undefined) {
      this.wire.unsubscribe(filter, complete);
    } else {
      this.wire.subscribe(filter, {qos: desired}, (error, granted) => {
        complete(error ?? (granted?.[0]?.qos > 2 ? new Error('MQTT broker refused the subscription') : undefined));
      });
    }
  }

  query(filter: unknown, page: LivePageRequest) {
    return this.index.search(validateQueryFilter(filter), page);
  }

  async publish(topic: string, payload: unknown, qos?: QoS, retain = false) {
    validateTopic(topic);
    if (this.closed || !this.wire.connected) throw new Error('MQTT broker is disconnected');
    if (typeof retain !== 'boolean') throw new Error('Invalid MQTT retain flag');
    const message =
      payload instanceof Uint8Array
        ? Buffer.from(payload)
        : typeof payload === 'string'
          ? payload
          : JSON.stringify(payload);
    if (message === undefined) throw new Error('MQTT payload is required');
    await this.wire.publishAsync(topic, message, {qos: asQos(qos), retain});
    return {topic};
  }

  readonly liveExplorer: LiveExplorer = {
    describe: () => ({
      tree: true,
      search: {fields: [{name: 'filter', type: 'string'}]},
      liveRows: true,
      capture: true,
      follow: true,
      publish: publishCommand,
    }),
    listChildren: (parent, page) => this.index.listChildren(parent, page),
    search: ({filter}, page) => this.query(filter, page),
    watchRow: (target, observer) => {
      validateTopic(target);
      const cached = this.index.get(target);
      if (cached) observer({type: 'snapshot', value: cached.preview, time: cached.observedAt, meta: {cached: true}});
      return this.subscribe({filter: target}, (event) => observer(asPreview(event)));
    },
    capture: ({filter}: DataMap, observer, follow) => {
      if (typeof filter !== 'string' || !filter || filter === '#')
        throw new Error('Enter a scoped MQTT filter to capture');
      if (follow) return this.subscribe({filter}, (event) => observer(asPreview(event)));
      let count = 0;
      const subscription = this.subscribe({filter}, (event) => {
        observer(asPreview(event));
        if (event.type === 'message' && ++count >= 256) finish();
      });
      const finish = () => {
        clearTimeout(timer);
        subscription.close();
        observer({type: 'status', status: 'closed'});
      };
      const timer = setTimeout(finish, 3000);
      return {
        close() {
          clearTimeout(timer);
          subscription.close();
        },
      };
    },
  };

  close() {
    if (this.closed) return;
    this.closed = true;
    this.setStatus({type: 'status', status: 'closed'});
    this.filters.clear();
    this.wildcardFilters.clear();
    this.statusObservers.clear();
    this.wire.end(true);
  }
}

function asPreview(event: LiveEvent): LiveEvent {
  return event.type === 'message' ? {...event, value: event.meta.preview} : event;
}
