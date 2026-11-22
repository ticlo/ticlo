import {BaseFunction} from '../../block/BlockFunction.ts';
import type {Block} from '../../block/Block.ts';
import {Event, EventType} from '../../block/Event.ts';
import {globalFunctions} from '../../block/FunctionModule.ts';
import {Library} from '../../block/Library.ts';
import {NoSerialize} from '../../util/NoSerialize.ts';
import {browserOAuthLink} from './BrowserOAuthLink.ts';
import {
  includesScopes,
  oauthClient,
  oauthHosts,
  oauthProfiles,
  OAuthRequired,
  oauthUrl,
  refreshOAuth,
  type OAuthGrant,
  type OAuthPopupResult,
  type OAuthSource,
} from './OAuth.ts';

const actions = new WeakMap<Block, {connect?(): string | Promise<string>; status(): string | Promise<string>}>();

class OAuthFunction extends BaseFunction<Block> {
  #dispose?: () => void;
  #startBrowser?: () => void;

  onCall(value: unknown) {
    // A bound browser event reaches onCall before the resolver queues run().
    if (Event.check(value) === EventType.TRIGGER) this.#startBrowser?.();
    return false;
  }

  run() {
    this.cleanup();
    const block = this._data;
    const get = (name: string) => {
      const value = block.getValue(name);
      return typeof value === 'string' ? value.trim() : '';
    };
    const profile = Object.freeze(new NoSerialize('auth:oauth'));
    const source = get('source') || 'browser';
    const scope = get('scope');
    const connection = get('connection');
    let active = true;
    let close = () => {};
    let opening: Window | undefined;
    let expires: ReturnType<typeof setTimeout> | undefined;
    this.#dispose = () => {
      active = false;
      close();
      opening?.close();
      this.#startBrowser = undefined;
      clearTimeout(expires);
      oauthProfiles.delete(profile);
      actions.delete(block);
    };
    const current = () =>
      active && (get('source') || 'browser') === source && get('scope') === scope && get('connection') === connection;
    if (source === 'browser') {
      if (typeof window === 'undefined') throw new Error('Browser OAuth requires a browser runtime');
      const provider = get('provider') || 'generic';
      const authorizationUrl = get('authorizationUrl');
      const tokenUrl = get('tokenUrl');
      const clientId = get('clientId');
      const configuredIssuer = get('issuer');
      const resourceOrigin = get('resourceOrigin');
      const appOrigin = get('appOrigin');
      const allowedOrigin = appOrigin ? oauthUrl(appOrigin).origin : undefined;
      const resource = oauthUrl(resourceOrigin);
      if (resource.href !== `${resource.origin}/`) throw new Error('Invalid OAuth resource origin');
      const popup = provider === 'google';
      if (!popup && provider !== 'generic') throw new Error('Unsupported browser OAuth provider');
      const callback = new URL('./oauth-callback.html', window.location.href);
      const issuer = popup ? '' : configuredIssuer || new URL(authorizationUrl).origin;
      if (issuer) callback.searchParams.set('provider', issuer);
      const client = popup
        ? undefined
        : oauthClient({
            authorizationUrl,
            tokenUrl,
            clientId,
            redirectUri: callback.href,
            resourceOrigin,
            scope,
          });
      const available = !allowedOrigin || allowedOrigin === window.location.origin;
      const checkOrigin = () => {
        if (!available) {
          throw new Error(`Open this flow at ${allowedOrigin} to authorize it.`);
        }
      };
      const valid = () =>
        current() &&
        (get('provider') || 'generic') === provider &&
        get('authorizationUrl') === authorizationUrl &&
        get('tokenUrl') === tokenUrl &&
        get('clientId') === clientId &&
        get('issuer') === configuredIssuer &&
        get('resourceOrigin') === resourceOrigin &&
        get('appOrigin') === appOrigin;
      let grant: OAuthGrant | undefined;
      let refresh: Promise<OAuthGrant> | undefined;
      let status = 'authorization-required';
      const setStatus = (value: string) => {
        status = value;
        if (value !== 'authorization-pending') opening = undefined;
        if (valid()) block.output(value, 'status');
      };
      let authorize: (() => Promise<OAuthPopupResult>) | undefined;
      const prepareForCall = () => {
        if (status === 'authorization-preparing') return;
        setStatus('authorization-preparing');
        void import('./GoogleOAuth.ts')
          .then(({prepareGoogleOAuth}) => prepareGoogleOAuth(clientId, scope, resource.origin))
          .then((start) => {
            if (valid()) {
              authorize = start;
              setStatus('authorization-required');
            }
          })
          .catch(() => setStatus('authorization-failed'));
      };
      const accept = (next: OAuthGrant) => {
        grant = next;
        if (popup) {
          clearTimeout(expires);
          expires = setTimeout(() => {
            if (grant !== next || !valid()) return;
            grant = undefined;
            if (status !== 'authorization-pending') setStatus('authorization-required');
          }, next.expiresAt - Date.now());
        }
        setStatus('authorized');
        block.output(new Event('authorized'), 'authorized');
      };
      const link = client && browserOAuthLink(client, issuer, valid, accept, setStatus);
      if (link) close = link.close;
      actions.set(block, {
        status: () => status,
        connect:
          link &&
          (() => {
            checkOrigin();
            return link.start();
          }),
      });
      oauthProfiles.set(profile, {
        origin: resource.origin,
        async token() {
          if (!valid() || !grant) throw new OAuthRequired();
          if (grant.expiresAt <= Date.now()) {
            if (!client) {
              grant = undefined;
              setStatus('authorization-required');
              throw new OAuthRequired();
            }
            const previous = grant;
            refresh ??= refreshOAuth(client, previous)
              .then((next) => {
                if (grant === previous) grant = next;
                return grant;
              })
              .catch((error) => {
                if (grant !== previous) return grant;
                if (error instanceof OAuthRequired) {
                  grant = undefined;
                  setStatus('authorization-required');
                }
                throw error;
              })
              .finally(() => {
                refresh = undefined;
              });
            const next = await refresh;
            if (!valid()) throw new OAuthRequired();
            return next.accessToken;
          }
          return grant.accessToken;
        },
      });
      setStatus(status);
      if (popup && available) prepareForCall();
      this.#startBrowser = () => {
        if (!valid()) return;
        if (!available) {
          setStatus('authorization-unavailable');
          return;
        }
        if (navigator.userActivation && !navigator.userActivation.isActive) return;
        if (popup) {
          if (status === 'authorization-pending') return;
          if (!authorize) {
            prepareForCall();
            return;
          }
          setStatus('authorization-pending');
          void authorize()
            .then((result) => {
              if (!valid()) return;
              if (typeof result === 'string') setStatus(result);
              else if (!includesScopes(result.scope, scope)) setStatus('authorization-denied');
              else accept(result);
            })
            .catch(() => setStatus('authorization-failed'));
          return;
        }
        if (opening && !opening.closed && status === 'authorization-pending') {
          opening.focus();
          return;
        }
        const tab = window.open('', '_blank', 'popup');
        if (!tab) {
          setStatus('authorization-failed');
          return;
        }
        opening?.close();
        tab.opener = null;
        opening = tab;
        setStatus('authorization-pending');
        void link
          .start()
          .then((url) => {
            if (opening !== tab) return;
            if (!valid() || tab.closed) {
              tab.close();
              close();
              setStatus('authorization-cancelled');
            } else {
              tab.location.replace(url);
            }
          })
          .catch(() => {
            tab.close();
            if (opening === tab) setStatus('authorization-failed');
          });
      };
    } else {
      const host = oauthHosts.get(Library.rootOf(block._flow));
      if (!host || !connection || (source !== 'connection' && source !== 'currentUser')) {
        throw new Error('OAuth connection is not configured on this host');
      }
      const mode: OAuthSource = source;
      oauthProfiles.set(profile, {
        origin: host.origin(connection),
        async token(context) {
          if (!current()) throw new OAuthRequired();
          const token = await host.token(connection, scope, mode, context);
          if (!current()) throw new OAuthRequired();
          return token;
        },
      });
      if (mode === 'connection') {
        actions.set(block, {
          connect: () => host.connect(connection, scope, current),
          status: () => host.status(connection, scope),
        });
      }
      block.output(mode === 'currentUser' ? 'request-context-required' : 'deployment-connection', 'status');
    }
    block.output(profile);
  }

  cleanup() {
    this.#dispose?.();
    this._data.output(undefined);
    this._data.output(undefined, 'status');
    this._data.output(undefined, 'authorized');
  }

  destroy() {
    this.#dispose?.();
    super.destroy();
  }
}

function getActions(block: Block) {
  const action = actions.get(block);
  if (!action) throw new Error('OAuth connection is not available');
  return action;
}

globalFunctions.addFactory(
  OAuthFunction,
  {
    name: 'oauth',
    mode: 'onLoad',
    priority: 0,
    tags: ['auth-profile', 'context-service'],
    properties: [
      {
        name: 'source',
        type: 'select',
        options: ['browser', 'connection', 'currentUser'],
        default: 'browser',
        pinned: true,
      },
      {name: 'provider', type: 'select', options: ['generic', 'google'], default: 'generic', pinned: true},
      {name: 'connection', type: 'string', pinned: true},
      {name: 'scope', type: 'string'},
      {name: 'authorizationUrl', type: 'string'},
      {name: 'tokenUrl', type: 'string'},
      {name: 'clientId', type: 'string'},
      {name: 'appOrigin', type: 'string'},
      {name: 'issuer', type: 'string'},
      {name: 'resourceOrigin', type: 'string'},
      {name: 'status', type: 'string', readonly: true},
      {name: 'authorized', type: 'event', readonly: true},
      {name: '#output', type: 'object', readonly: true, pinned: true},
    ],
    commands: {
      connectOAuth: {parameters: [], hidden: true},
      oauthStatus: {parameters: [], hidden: true, readonly: true},
    },
  },
  'auth',
  {
    commands: {
      async connectOAuth(block, _params, readonly) {
        if (readonly) throw new Error('readonly');
        const {connect} = getActions(block);
        if (!connect) throw new Error('This OAuth provider requires a user gesture in the browser runtime.');
        return {url: await connect()};
      },
      async oauthStatus(block) {
        return {status: await getActions(block).status()};
      },
    },
  }
);
