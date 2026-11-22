import {
  BaseFunction,
  ErrorEvent,
  Event,
  EventType,
  configDescs,
  globalFunctions,
  type Block,
  type BlockConfig,
  type BlockIO,
} from '@ticlo/core';
import {Library} from '@ticlo/core/block/Library.ts';
import {HttpAuthRequired, httpAuthProfiles} from '@ticlo/core/functions/http/HttpAuth.ts';
import {NoSerialize} from '@ticlo/core/util/NoSerialize.ts';
import {oauthHosts} from './OAuthRoutes.ts';

export {routeOAuth, type OAuthGrantStore, type OAuthServerOptions} from './OAuthRoutes.ts';
export {createFileOAuthGrantStore} from './OAuthGrantStore.ts';
export type {OAuthClient, OAuthGrant} from './OAuth.ts';

const actions = new WeakMap<Block, {start(): string; complete(status: string): void; status(): Promise<string>}>();
const completionAuthority = Symbol('OAuth completion');
const missingClientSecret = 'Set the OAuth Client Secret in #secret';
const inputs = new Set([
  'source',
  'connection',
  'clientId',
  'requireClientSecret',
  'authorizationUrl',
  'tokenUrl',
  'resourceOrigin',
  'scope',
]);

class NodeOAuthFunction extends BaseFunction<Block> {
  #dispose?: () => void;
  #getSecret: () => string | undefined;

  initInputs(getSecret: () => string | undefined) {
    this.#getSecret = getSecret;
  }

  inputChanged(input: BlockIO) {
    if (!inputs.has(input.getName())) return false;
    this.#dispose?.();
    return true;
  }

  configChanged(config: BlockConfig) {
    if (config.getName() !== '#secret') return false;
    this.#dispose?.();
    return true;
  }

  onCall(value: unknown) {
    if (Event.check(value) === EventType.TRIGGER) {
      try {
        actions.get(this._data)?.start();
      } catch (error) {
        this._data.emit(new ErrorEvent('authorization-failed', error));
      }
    }
    return false;
  }

  run() {
    this.cleanup();
    const block = this._data;
    const get = (key: string) => {
      const value = block.getValue(key);
      return typeof value === 'string' ? value.trim() : '';
    };
    const source = get('source') || 'server';
    if (source !== 'server' && source !== 'connection' && source !== 'currentUser') {
      throw new Error('This Flow requires the browser OAuth connector');
    }
    const root = Library.rootOf(block._flow);
    const host = oauthHosts.get(root);
    if (!host) {
      block.output('host-not-configured', 'status');
      throw new Error('OAuth routes are not configured on this host');
    }
    const owner = block.getFullPath();
    const connection = get('connection');
    const scope = get('scope');
    let registration: ReturnType<typeof host.named>;
    if (source === 'server') {
      const clientSecret = this.#getSecret() || undefined;
      if (block.getValue('requireClientSecret') === true && clientSecret === undefined) {
        block.output('client-secret-required', 'status');
        throw new Error(missingClientSecret);
      }
      registration = host.configure(connection, owner, {
        clientId: get('clientId'),
        clientSecret,
        authorizationUrl: get('authorizationUrl'),
        tokenUrl: get('tokenUrl'),
        resourceOrigin: get('resourceOrigin'),
        scope,
      });
    } else {
      registration = host.named(connection);
    }
    const profile = Object.freeze(new NoSerialize('auth:oauth'));
    let active = true;
    let statusPublished = false;
    let linkRevision = 0;
    const current = () => active && block.getFullPath() === owner && oauthHosts.get(root) === host;
    const publish = (status: string) => {
      if (!current()) return;
      statusPublished = true;
      block.output(status, 'status');
      if (status === 'authorized') block.output(new Event('authorized'), 'authorized');
    };
    this.#dispose = () => {
      active = false;
      httpAuthProfiles.delete(profile);
      actions.delete(block);
      this.#dispose = undefined;
    };
    httpAuthProfiles.set(profile, {
      origin: registration.client.resourceOrigin,
      async token(context) {
        if (!current()) throw new HttpAuthRequired();
        try {
          const token = await host.token(
            registration,
            scope,
            source === 'currentUser' ? source : 'connection',
            context
          );
          if (!current()) throw new HttpAuthRequired();
          return token;
        } catch (error) {
          if (source !== 'currentUser' && error instanceof HttpAuthRequired && !block.getValue('authorizationLink')) {
            publish('authorization-required');
          }
          throw error;
        }
      },
    });
    block.output(profile);
    if (source === 'currentUser') {
      block.output('request-context-required', 'status');
      return;
    }
    const status = () => host.status(registration, scope);
    const publishAuthorization = (value: string) => {
      block.output(undefined, 'authorizationLink');
      publish(value);
    };
    actions.set(block, {
      start() {
        if (!current()) throw new HttpAuthRequired();
        const revision = ++linkRevision;
        const linkCurrent = () => revision === linkRevision && current();
        block.output(undefined, 'authorizationLink');
        const url = host.connect(registration, scope, {
          current: linkCurrent,
          pending() {
            if (linkCurrent()) publishAuthorization('authorization-pending');
          },
          complete(status) {
            if (linkCurrent()) block.executeCommand('completeAuthorization', {status, authority: completionAuthority});
          },
        });
        block.output(url, 'authorizationLink');
        publish('authorization-link-ready');
        return url;
      },
      complete: publishAuthorization,
      status,
    });
    block.output('authorization-required', 'status');
    void status().then(
      (value) => {
        if (!statusPublished) publish(value);
      },
      () => {
        if (!statusPublished) publish('authorization-failed');
      }
    );
  }

  cleanup() {
    this.#dispose?.();
    this._data.output(undefined);
    this._data.output(undefined, 'status');
    this._data.output(undefined, 'authorizationLink');
    this._data.output(undefined, 'authorized');
  }

  destroy() {
    this.#dispose?.();
    super.destroy();
  }
}

function getActions(block: Block) {
  const action = actions.get(block);
  if (action) return action;
  switch (block.getValue('status')) {
    case 'host-not-configured':
      throw new Error('OAuth routes are not configured on this host');
    case 'client-secret-required':
      throw new Error(missingClientSecret);
    case 'request-context-required':
      throw new Error('This OAuth source requires an authenticated request');
    default:
      throw new Error('OAuth connection is not available');
  }
}

function startAuthorization(block: Block, _params: unknown, readonly: boolean) {
  if (readonly) throw new Error('readonly');
  return {url: getActions(block).start()};
}

export function registerOAuth() {
  globalFunctions.addUniqueFactory(
    NodeOAuthFunction,
    {
      name: 'oauth',
      tags: ['auth-profile', 'context-service'],
      properties: [
        {
          name: 'source',
          type: 'select',
          options: ['server', 'connection', 'currentUser'],
          default: 'server',
          pinned: true,
        },
        {name: 'connection', type: 'string', pinned: true},
        {name: 'clientId', type: 'string'},
        configDescs['#secret'],
        {name: 'requireClientSecret', type: 'toggle', default: false},
        {name: 'authorizationUrl', type: 'string'},
        {name: 'tokenUrl', type: 'string'},
        {name: 'resourceOrigin', type: 'string'},
        {name: 'scope', type: 'string'},
        {name: 'status', type: 'string', readonly: true},
        {name: 'authorizationLink', type: 'string', readonly: true},
        {name: 'authorized', type: 'event', readonly: true},
        {name: '#output', type: 'object', readonly: true, pinned: true},
      ],
      commands: {
        startAuthorization: {parameters: [], results: [{name: 'url', type: 'string', readonly: true}]},
        connectOAuth: {parameters: [], hidden: true},
        oauthStatus: {parameters: [], hidden: true, readonly: true},
      },
    },
    'auth',
    {
      commands: {
        startAuthorization,
        connectOAuth: startAuthorization,
        completeAuthorization(block, params, readonly) {
          // Editor commands travel over the same API. Only the host can supply this symbol.
          if (readonly || params?.authority !== completionAuthority || typeof params.status !== 'string') {
            throw new Error('Authorization completion is server-only');
          }
          getActions(block).complete(params.status);
        },
        async oauthStatus(block) {
          return {status: await getActions(block).status()};
        },
      },
    }
  );
}
