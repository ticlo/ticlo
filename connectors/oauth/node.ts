import {
  AuthorizationRequiredError,
  BaseFunction,
  ErrorEvent,
  Event,
  EventType,
  Logger,
  configDescs,
  createUnreadyOAuthProfile,
  globalFunctions,
  oauthProfiles,
  type Block,
  type BlockConfig,
  type BlockIO,
  type OAuthToken,
  type OAuthTokenOptions,
} from '@ticlo/core';
import {Library} from '@ticlo/core/block/Library.ts';
import {NoSerialize} from '@ticlo/core/util/NoSerialize.ts';
import {
  includesScopes,
  isGrantUsable,
  oauthClientCredentials,
  requestClientCredentials,
  type OAuthGrant,
} from './OAuth.ts';
import {oauthHosts, type AuthCodeRegistration, type Registration} from './OAuthRoutes.ts';

export {routeOAuth, type OAuthConnectionConfig, type OAuthGrantStore, type OAuthServerOptions} from './OAuthRoutes.ts';
export {createFileOAuthGrantStore} from './OAuthGrantStore.ts';
export type {OAuthClient, OAuthClientCredentialsClient, OAuthGrant} from './OAuth.ts';

const actions = new WeakMap<Block, {start(): string; complete(status: string): void; status(): Promise<string>}>();
const completionAuthority = Symbol('OAuth completion');
const missingClientSecret = 'Set the OAuth Client Secret in #secret';
const inputs = new Set([
  'source',
  'grantType',
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
    this.#dispose?.();
    const block = this._data;
    block.output(undefined, 'authorizationLink');
    block.output(undefined, 'authorized');
    const get = (key: string) => {
      const value = block.getValue(key);
      return typeof value === 'string' ? value.trim() : '';
    };
    const owner = block.getFullPath();
    const root = Library.rootOf(block._flow);
    const host = oauthHosts.get(root);
    let publishedStatus = false;
    const setInitialStatus = (value: string) => {
      publishedStatus = true;
      block.output(value, 'status');
    };

    try {
      const source = get('source') || 'server';
      if (source !== 'server' && source !== 'connection' && source !== 'currentUser') {
        throw new Error('This Flow requires the browser OAuth connector');
      }
      const explicitGrantType = get('grantType');
      if (
        explicitGrantType &&
        explicitGrantType !== 'authorization_code' &&
        explicitGrantType !== 'client_credentials'
      ) {
        throw new Error('Unsupported OAuth grant type');
      }
      const connection = get('connection');
      const scope = get('scope');

      let registration: Registration | undefined;
      let grantType: 'authorization_code' | 'client_credentials';

      if (source === 'connection') {
        if (!host) {
          setInitialStatus('host-not-configured');
          throw new Error('OAuth routes are not configured on this host');
        }
        registration = host.named(connection);
        if (explicitGrantType && explicitGrantType !== registration.grantType) {
          throw new Error('OAuth grantType does not match the configured connection');
        }
        grantType = registration.grantType;
      } else if (source === 'currentUser') {
        if (explicitGrantType && explicitGrantType !== 'authorization_code') {
          throw new Error('Client credentials OAuth cannot use currentUser');
        }
        if (!host) {
          setInitialStatus('host-not-configured');
          throw new Error('OAuth routes are not configured on this host');
        }
        registration = host.named(connection);
        if (registration.grantType !== 'authorization_code') {
          throw new Error('currentUser requires an authorization_code connection');
        }
        grantType = 'authorization_code';
      } else {
        grantType = (explicitGrantType as 'authorization_code' | 'client_credentials') || 'authorization_code';
        if (grantType === 'client_credentials') {
          if (host && !host.allowFlowClients) {
            throw new Error('Flow-configured OAuth is disabled on this host');
          }
          const clientSecret = this.#getSecret() || undefined;
          if (clientSecret === undefined) {
            setInitialStatus('client-secret-required');
            throw new Error(missingClientSecret);
          }
          const client = oauthClientCredentials({
            clientId: get('clientId'),
            clientSecret,
            tokenUrl: get('tokenUrl'),
            resourceOrigin: get('resourceOrigin'),
            scope,
          });
          registration = {grantType: 'client_credentials', name: connection || owner, client, key: ''};
        } else {
          if (!host) {
            setInitialStatus('host-not-configured');
            throw new Error('OAuth routes are not configured on this host');
          }
          const clientSecret = this.#getSecret() || undefined;
          if (block.getValue('requireClientSecret') === true && clientSecret === undefined) {
            setInitialStatus('client-secret-required');
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
        }
      }

      const profile = Object.freeze(new NoSerialize('auth:oauth'));
      let active = true;
      let statusPublished = false;
      let lastStatus: string | undefined;
      let linkRevision = 0;
      const observers = new Set<(status: string) => void>();
      const current = () =>
        active &&
        block.getFullPath() === owner &&
        (source !== 'server' && !host ? false : oauthHosts.get(root) === host);

      const notifyObservers = (value: string) => {
        for (const listener of [...observers]) {
          try {
            listener(value);
          } catch (error) {
            Logger.warn('OAuth status observer failed', error);
          }
        }
      };

      const publish = (value: string) => {
        if (!current()) return;
        statusPublished = true;
        const changed = lastStatus !== value;
        lastStatus = value;
        block.output(value, 'status');
        if (value === 'authorized' && changed) block.output(new Event('authorized'), 'authorized');
        if (changed) notifyObservers(value);
      };

      let hostSubscription: {close(): void} | undefined;
      let cachedGrant: OAuthGrant | undefined;
      let pendingToken: Promise<OAuthToken> | undefined;

      this.#dispose = () => {
        active = false;
        hostSubscription?.close();
        hostSubscription = undefined;
        observers.clear();
        cachedGrant = undefined;
        oauthProfiles.delete(profile);
        actions.delete(block);
        this.#dispose = undefined;
      };

      const getToken = async (context?: unknown, options?: OAuthTokenOptions): Promise<OAuthToken> => {
        if (!current()) throw new AuthorizationRequiredError();
        if (grantType === 'client_credentials' && source === 'server') {
          const client = (registration as Extract<Registration, {grantType: 'client_credentials'}>).client;
          if (!includesScopes(client.scope, scope)) throw new AuthorizationRequiredError();
          if (!options?.forceRefresh && cachedGrant && isGrantUsable(cachedGrant, true)) {
            return {accessToken: cachedGrant.accessToken, expiresAt: cachedGrant.expiresAt};
          }
          if (pendingToken) {
            const token = await pendingToken;
            if (!current()) throw new AuthorizationRequiredError();
            if (!options?.forceRefresh || (options.rejectedToken && token.accessToken !== options.rejectedToken)) {
              return token;
            }
          }
          const runFetch = (async () => {
            if (
              cachedGrant &&
              isGrantUsable(cachedGrant, true) &&
              (!options?.forceRefresh || (options.rejectedToken && cachedGrant.accessToken !== options.rejectedToken))
            ) {
              return {accessToken: cachedGrant.accessToken, expiresAt: cachedGrant.expiresAt};
            }
            const next = await requestClientCredentials(client, client.scope);
            if (!current()) throw new AuthorizationRequiredError();
            cachedGrant = next;
            publish('authorized');
            return {accessToken: next.accessToken, expiresAt: next.expiresAt};
          })();
          const tracked = runFetch.finally(() => {
            if (pendingToken === tracked) pendingToken = undefined;
          });
          pendingToken = tracked;
          return tracked;
        }

        if (!host) throw new AuthorizationRequiredError();
        try {
          const token = await host.token(
            registration,
            scope,
            source === 'currentUser' ? source : 'connection',
            context,
            options
          );
          if (!current()) throw new AuthorizationRequiredError();
          if (source !== 'currentUser' && !block.getValue('authorizationLink')) publish('authorized');
          return token;
        } catch (error) {
          if (
            source !== 'currentUser' &&
            error instanceof AuthorizationRequiredError &&
            !block.getValue('authorizationLink')
          ) {
            publish('authorization-required');
          }
          throw error;
        }
      };

      oauthProfiles.set(profile, {
        ready: true,
        origin: registration.client.resourceOrigin,
        requiresContext: source === 'currentUser',
        token: getToken,
        observe(listener) {
          observers.add(listener);
          return {
            close() {
              observers.delete(listener);
            },
          };
        },
      });
      block.output(profile);

      if (source === 'currentUser') {
        block.output('request-context-required', 'status');
        return;
      }

      if (grantType === 'client_credentials') {
        if (host && registration.key) {
          hostSubscription = host.observe(registration.key, (value) => {
            if (lastStatus !== value) publish(value);
          });
        }
        const status = () =>
          host && registration.key ? host.status(registration, scope) : Promise.resolve(lastStatus ?? 'ready');
        actions.set(block, {
          start() {
            throw new Error('Client credentials OAuth does not require interactive authorization');
          },
          complete() {},
          status,
        });
        lastStatus = 'ready';
        block.output('ready', 'status');
        if (host && registration.key) {
          void status().then(
            (value) => {
              if (!statusPublished) publish(value);
            },
            () => {}
          );
        }
        return;
      }

      const authCodeRegistration = registration as AuthCodeRegistration;
      const status = () => host.status(authCodeRegistration, scope);
      const publishAuthorization = (value: string) => {
        block.output(undefined, 'authorizationLink');
        publish(value);
      };
      hostSubscription = host.observe(authCodeRegistration.key, (value) => {
        if (lastStatus !== value) publishAuthorization(value);
      });
      actions.set(block, {
        start() {
          if (!current()) throw new AuthorizationRequiredError();
          const revision = ++linkRevision;
          const linkCurrent = () => revision === linkRevision && current();
          block.output(undefined, 'authorizationLink');
          const url = host.connect(authCodeRegistration, scope, {
            current: linkCurrent,
            pending() {
              if (linkCurrent()) publishAuthorization('authorization-pending');
            },
            complete(status) {
              if (linkCurrent())
                block.executeCommand('completeAuthorization', {status, authority: completionAuthority});
            },
          });
          block.output(url, 'authorizationLink');
          publish('authorization-link-ready');
          return url;
        },
        complete: publishAuthorization,
        status,
      });
      lastStatus = 'authorization-required';
      block.output('authorization-required', 'status');
      void status().then(
        (value) => {
          if (!statusPublished) publish(value);
        },
        () => {
          if (!statusPublished) publish('authorization-failed');
        }
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      const unready = createUnreadyOAuthProfile(reason);
      this.#dispose = () => {
        oauthProfiles.delete(unready);
        actions.delete(block);
        this.#dispose = undefined;
      };
      if (!publishedStatus) {
        block.output('invalid-config', 'status');
      }
      block.output(unready);
      throw error;
    }
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
    case 'ready':
      throw new Error('Client credentials OAuth does not require interactive authorization');
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
      mode: 'onLoad',
      priority: 0,
      tags: ['auth-profile', 'context-service'],
      properties: [
        {
          name: 'source',
          type: 'select',
          options: ['server', 'connection', 'currentUser'],
          default: 'server',
          pinned: true,
        },
        {
          name: 'grantType',
          type: 'select',
          options: ['authorization_code', 'client_credentials'],
          default: 'authorization_code',
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
