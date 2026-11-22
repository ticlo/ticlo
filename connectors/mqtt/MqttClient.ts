import {connect, type IClientOptions, type MqttClient as WireClient} from 'mqtt';
import {
  AuthorizationRequiredError,
  Logger,
  isBearerToken,
  resourceOriginOf,
  type DataMap,
  type FunctionCommandDesc,
  type LiveEvent,
  type LiveExplorer,
  type LiveObserver,
  type LivePageRequest,
  type LiveSource,
  type OAuthProfileState,
  type OAuthToken,
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
  oauth?: OAuthProfileState;
  authMethod?: string;
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

const authErrorCodes = new Set([4, 5, 134, 135, 140]);
const authDisconnectCodes = new Set([134, 135, 140, 160]);

function isMqttAuthErrorCode(code: unknown): boolean {
  return typeof code === 'number' && authDisconnectCodes.has(code);
}

function isMqttAuthError(error: Error): boolean {
  const code = (error as {code?: unknown}).code;
  if (typeof code === 'number' && authErrorCodes.has(code)) return true;
  return /not authorized|bad user|bad authentication method/i.test(error.message);
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
  private wire?: WireClient;
  private oauth?: OAuthProfileState;
  private oauthObserver?: {close(): void};
  private oauthConfig?: {url: string; username?: string; authMethod?: string; baseOptions: IClientOptions};
  private connectGeneration = 0;
  private connectInFlight = false;
  private awaitingAuthorization = false;
  private refreshedForAuthError = false;
  private activeToken?: string;
  private refreshTimer?: ReturnType<typeof setTimeout>;
  private retryTimer?: ReturnType<typeof setTimeout>;

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
    oauth,
    authMethod,
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
    if (authMethod !== undefined && typeof authMethod !== 'string') {
      throw new Error('Invalid MQTT auth method');
    }
    const normalizedAuthMethod = authMethod?.trim() || undefined;
    if (normalizedAuthMethod && !oauth) {
      throw new Error('MQTT authMethod requires OAuth authentication');
    }

    const baseOptions: IClientOptions = {
      ...(tlsClientIdentity == null ? undefined : getTlsClientIdentity(tlsClientIdentity)),
      protocolVersion,
      clientId,
      keepalive,
      ca,
      rejectUnauthorized: true,
      clean: true,
      resubscribe: false,
      queueQoSZero: false,
    };

    if (oauth) {
      if (password !== undefined) throw new Error('MQTT cannot combine password and OAuth authentication');
      if (!oauth.ready) throw new Error(oauth.reason ?? 'OAuth is not ready');
      if (oauth.requiresContext) throw new Error('MQTT client does not support currentUser OAuth');
      let actualOrigin: string;
      try {
        actualOrigin = resourceOriginOf(address);
      } catch {
        throw new Error('MQTT OAuth requires TLS on non-loopback hosts');
      }
      if (actualOrigin !== oauth.origin) {
        throw new Error('MQTT OAuth destination is outside the configured resource origin');
      }
      if (normalizedAuthMethod && protocolVersion !== 5) {
        throw new Error('MQTT enhanced authentication requires protocolVersion 5');
      }
      this.oauth = oauth;
      this.oauthConfig = {url: address.href, username, authMethod: normalizedAuthMethod, baseOptions};
      this.oauthObserver = oauth.observe?.((status) => {
        if (this.closed) return;
        if (status === 'authorized') {
          void this.onOAuthAuthorized();
        } else if (status === 'authorization-required') {
          this.onOAuthRequired();
        }
      });
      void this.connectWithOAuth(false);
      return;
    }

    const wire = (this.wire = connect(address.href, {
      ...baseOptions,
      username,
      password,
    }));
    this.attachCommonHandlers(wire);
    wire.on('connect', () => {
      if (this.wire !== wire || this.closed) return;
      for (const filter of this.filters.keys()) this.syncFilter(filter);
      this.setStatus({type: 'status', status: 'connected'});
      if (this.connectedOnce) this.notify({type: 'gap'});
      this.connectedOnce = true;
    });
    wire.on('reconnect', () => {
      if (this.wire !== wire || this.closed) return;
      this.setStatus({type: 'status', status: 'connecting'});
    });
    wire.on('close', () => {
      if (this.wire !== wire) return;
      ++this.epoch;
      this.sent.clear();
      this.pending.clear();
      if (!this.closed) this.setStatus({type: 'status', status: 'disconnected'});
    });
    wire.on('error', (error) => {
      if (this.wire !== wire || this.closed) return;
      this.setStatus({type: 'status', status: 'error', message: error.message});
    });
  }

  private attachCommonHandlers(wire: WireClient) {
    wire.on('message', (topic, payload, packet) => {
      if (this.wire !== wire || this.closed) return;
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

  private clearOAuthTimers() {
    clearTimeout(this.refreshTimer);
    this.refreshTimer = undefined;
    clearTimeout(this.retryTimer);
    this.retryTimer = undefined;
  }

  private teardownWire() {
    const oldWire = this.wire;
    this.wire = undefined;
    this.activeToken = undefined;
    if (oldWire) {
      ++this.epoch;
      this.sent.clear();
      this.pending.clear();
      oldWire.end(true);
    }
  }

  private async teardownWireGracefully() {
    const oldWire = this.wire;
    this.wire = undefined;
    this.activeToken = undefined;
    if (!oldWire) return;
    ++this.epoch;
    this.sent.clear();
    this.pending.clear();
    if (oldWire.connected && Object.keys(oldWire.outgoing).length > 0) {
      await new Promise<void>((resolve) => {
        const done = () => {
          clearTimeout(timer);
          oldWire.removeListener('outgoingEmpty', done);
          oldWire.removeListener('close', done);
          resolve();
        };
        const timer = setTimeout(done, 200);
        oldWire.once('outgoingEmpty', done);
        oldWire.once('close', done);
      });
    }
    oldWire.end(true);
  }

  private async onOAuthAuthorized() {
    if (this.closed || !this.oauth) return;
    if (this.awaitingAuthorization || (!this.connectInFlight && !this.wire?.connected)) {
      this.refreshedForAuthError = false;
      void this.connectWithOAuth(false);
      return;
    }
    if (this.wire?.connected) {
      const generation = this.connectGeneration;
      try {
        const next = await this.oauth.token();
        if (this.closed || generation !== this.connectGeneration || !isBearerToken(next.accessToken)) return;
        if (next.accessToken !== this.activeToken) {
          this.refreshedForAuthError = false;
          await this.openOAuthWire(generation, next);
        }
      } catch {
        // Ignore transient probe errors when already connected.
      }
    }
  }

  private onOAuthRequired() {
    if (this.closed) return;
    ++this.connectGeneration;
    this.clearOAuthTimers();
    this.teardownWire();
    this.awaitingAuthorization = true;
    this.setStatus({type: 'status', status: 'error', message: 'Authorization required'});
  }

  private async connectWithOAuth(forceRefresh: boolean, rejectedToken?: string) {
    if (this.closed || !this.oauth || !this.oauthConfig) return;
    const generation = ++this.connectGeneration;
    this.clearOAuthTimers();
    this.awaitingAuthorization = false;
    this.connectInFlight = true;
    this.setStatus({type: 'status', status: 'connecting'});
    try {
      const token = await this.oauth.token(undefined, forceRefresh ? {forceRefresh: true, rejectedToken} : undefined);
      if (this.closed || generation !== this.connectGeneration) return;
      if (!isBearerToken(token.accessToken)) {
        throw new Error('Invalid OAuth access token');
      }
      await this.openOAuthWire(generation, token);
    } catch (error) {
      if (this.closed || generation !== this.connectGeneration) return;
      const message = error instanceof Error ? error.message : String(error);
      this.setStatus({type: 'status', status: 'error', message});
      if (error instanceof AuthorizationRequiredError) {
        this.awaitingAuthorization = true;
      } else {
        this.scheduleOAuthRetry(generation);
      }
    } finally {
      if (generation === this.connectGeneration) {
        this.connectInFlight = false;
      }
    }
  }

  private async openOAuthWire(generation: number, token: OAuthToken) {
    if (this.closed || generation !== this.connectGeneration || !this.oauthConfig) return;
    this.clearOAuthTimers();
    this.setStatus({type: 'status', status: 'connecting'});
    await this.teardownWireGracefully();
    if (this.closed || generation !== this.connectGeneration || !this.oauthConfig) return;
    this.activeToken = token.accessToken;

    const {url, username, authMethod, baseOptions} = this.oauthConfig;
    const connectOpts: IClientOptions = {
      ...baseOptions,
      reconnectPeriod: 0,
    };
    if (authMethod) {
      if (username !== undefined) connectOpts.username = username;
      connectOpts.properties = {
        ...baseOptions.properties,
        authenticationMethod: authMethod,
        authenticationData: Buffer.from(token.accessToken, 'utf8'),
      };
    } else {
      connectOpts.username = username ?? '';
      connectOpts.password = token.accessToken;
    }

    let authRejected = false;
    let sawError = false;
    const wire = connect(url, connectOpts);
    this.wire = wire;
    this.attachCommonHandlers(wire);

    wire.on('connect', () => {
      if (this.wire !== wire || this.closed || generation !== this.connectGeneration) return;
      this.refreshedForAuthError = false;
      this.awaitingAuthorization = false;
      for (const filter of this.filters.keys()) this.syncFilter(filter);
      this.setStatus({type: 'status', status: 'connected'});
      if (this.connectedOnce) this.notify({type: 'gap'});
      this.connectedOnce = true;
      this.scheduleOAuthRefresh(generation, token);
    });
    wire.on('disconnect', (packet) => {
      if (this.wire !== wire || this.closed) return;
      if (isMqttAuthErrorCode(packet.reasonCode)) {
        authRejected = true;
        sawError = true;
        this.setStatus({type: 'status', status: 'error', message: 'Not authorized'});
      }
    });
    wire.on('error', (error) => {
      if (this.wire !== wire || this.closed) return;
      sawError = true;
      if (isMqttAuthError(error)) authRejected = true;
      this.setStatus({type: 'status', status: 'error', message: error.message});
    });
    wire.on('close', () => {
      if (this.wire !== wire || this.closed || generation !== this.connectGeneration) return;
      this.clearOAuthTimers();
      ++this.epoch;
      this.sent.clear();
      this.pending.clear();
      this.wire = undefined;
      this.activeToken = undefined;
      if (authRejected) {
        if (!this.refreshedForAuthError) {
          this.refreshedForAuthError = true;
          void this.connectWithOAuth(true, token.accessToken);
        } else {
          this.awaitingAuthorization = true;
        }
        return;
      }
      if (!sawError) {
        this.setStatus({type: 'status', status: 'disconnected'});
      }
      this.scheduleOAuthRetry(generation);
    });
  }

  private scheduleOAuthRetry(generation: number) {
    if (this.closed || generation !== this.connectGeneration) return;
    clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = undefined;
      if (this.closed || generation !== this.connectGeneration) return;
      void this.connectWithOAuth(false);
    }, 1000);
  }

  private scheduleOAuthRefresh(generation: number, token: OAuthToken) {
    if (this.closed || generation !== this.connectGeneration || !this.oauth) return;
    clearTimeout(this.refreshTimer);
    const remaining = token.expiresAt - Date.now();
    const margin = Math.min(30_000, Math.max(0, Math.floor(remaining / 4)));
    const refreshAt = token.expiresAt - margin;
    const delay = Math.min(2_147_483_647, Math.max(200, refreshAt - Date.now()));
    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = undefined;
      if (this.closed || generation !== this.connectGeneration || !this.oauth) return;
      if (Date.now() + 200 < refreshAt) {
        this.scheduleOAuthRefresh(generation, token);
        return;
      }
      void this.refreshOAuthConnection(generation, token.accessToken);
    }, delay);
  }

  private async refreshOAuthConnection(generation: number, currentToken: string) {
    if (this.closed || generation !== this.connectGeneration || !this.oauth) return;
    try {
      const next = await this.oauth.token(undefined, {forceRefresh: true, rejectedToken: currentToken});
      if (this.closed || generation !== this.connectGeneration) return;
      if (!isBearerToken(next.accessToken)) throw new Error('Invalid OAuth access token');
      if (next.accessToken !== this.activeToken) {
        await this.openOAuthWire(generation, next);
      } else if (next.expiresAt > Date.now() + 1000) {
        this.scheduleOAuthRefresh(generation, next);
      }
    } catch (error) {
      if (this.closed || generation !== this.connectGeneration) return;
      const message = error instanceof Error ? error.message : String(error);
      if (error instanceof AuthorizationRequiredError) {
        this.teardownWire();
        this.awaitingAuthorization = true;
        this.setStatus({type: 'status', status: 'error', message});
        return;
      }
      if (this.wire?.connected) {
        clearTimeout(this.refreshTimer);
        this.refreshTimer = setTimeout(() => {
          this.refreshTimer = undefined;
          void this.refreshOAuthConnection(generation, currentToken);
        }, 1000);
      }
    }
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
    if (!this.wire?.connected || this.closed || this.pending.has(filter)) return;
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
    if (this.closed || !this.wire?.connected) throw new Error('MQTT broker is disconnected');
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
    ++this.connectGeneration;
    this.clearOAuthTimers();
    this.oauthObserver?.close();
    this.oauthObserver = undefined;
    this.setStatus({type: 'status', status: 'closed'});
    this.filters.clear();
    this.wildcardFilters.clear();
    this.statusObservers.clear();
    this.teardownWire();
  }
}

function asPreview(event: LiveEvent): LiveEvent {
  return event.type === 'message' ? {...event, value: event.meta.preview} : event;
}
