import {Block} from '../../block/Block.ts';
import type {FunctionApi} from '../../block/BlockFunction.ts';
import type {FunctionCommandDesc} from '../../block/Descriptor.ts';
import {globalFunctions} from '../../block/FunctionModule.ts';
import type {DataMap} from '../../util/DataTypes.ts';
import {NoSerialize} from '../../util/NoSerialize.ts';

export class AuthorizationRequiredError extends Error {
  constructor(message = 'Authorization required') {
    super(message);
    this.name = 'authorization-required';
  }
}

export interface OAuthToken {
  accessToken: string;
  expiresAt: number;
}

export interface OAuthTokenOptions {
  forceRefresh?: boolean;
  rejectedToken?: string;
}

export interface OAuthProfileState {
  readonly ready: boolean;
  readonly reason?: string;
  readonly origin?: string;
  readonly requiresContext?: boolean;
  token(context?: unknown, options?: OAuthTokenOptions): Promise<OAuthToken>;
  observe?(listener: (status: string) => void): {close(): void};
}

export const oauthProfiles = new WeakMap<object, OAuthProfileState>();

export function createUnreadyOAuthProfile(reason: string): Readonly<NoSerialize> {
  const profile = Object.freeze(new NoSerialize('auth:oauth'));
  oauthProfiles.set(profile, {
    ready: false,
    reason,
    async token() {
      throw new AuthorizationRequiredError(reason);
    },
  });
  return profile;
}

export function isBearerToken(value: unknown): value is string {
  return typeof value === 'string' && /^[a-zA-Z0-9._~+/-]+=*$/.test(value);
}

const loopbackHosts = new Set(['localhost', '127.0.0.1', '[::1]']);
const secureResourceSchemes = new Set(['https:', 'wss:', 'mqtts:']);
const loopbackResourceSchemes = new Set(['http:', 'ws:', 'mqtt:']);
const defaultSchemePorts: Record<string, string> = {
  'http:': '80',
  'https:': '443',
  'ws:': '80',
  'wss:': '443',
  'mqtt:': '1883',
  'mqtts:': '8883',
};

export function authUrl(value: string): URL {
  const url = new URL(value);
  if (
    url.username ||
    url.password ||
    url.hash ||
    (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopbackHosts.has(url.hostname.toLowerCase())))
  ) {
    throw new Error('Invalid authorization URL');
  }
  return url;
}

export function resourceOriginOf(value: string | URL): string {
  const url = value instanceof URL ? value : new URL(value);
  const hostname = url.hostname.toLowerCase();
  if (
    !hostname ||
    url.username ||
    url.password ||
    url.hash ||
    (!secureResourceSchemes.has(url.protocol) &&
      !(loopbackResourceSchemes.has(url.protocol) && loopbackHosts.has(hostname)))
  ) {
    throw new Error('Invalid resource URL');
  }
  const defaultPort = defaultSchemePorts[url.protocol];
  const port = url.port && url.port !== defaultPort ? `:${url.port}` : '';
  return `${url.protocol}//${hostname}${port}`;
}

export function normalizeResourceOrigin(value: string): string {
  if (typeof value !== 'string') throw new Error('Invalid resource origin');
  const url = new URL(value);
  if (url.search || value.includes('?') || (url.pathname !== '' && url.pathname !== '/')) {
    throw new Error('Invalid resource origin');
  }
  return resourceOriginOf(url);
}

export const clientAuthCommands: Record<string, FunctionCommandDesc> = {
  startAuthorization: {
    parameters: [],
    results: [{name: 'url', type: 'string', readonly: true}],
    hidden: true,
  },
  oauthStatus: {
    parameters: [],
    hidden: true,
    readonly: true,
  },
};

export function forwardEmbeddedAuthCommand(
  command: 'startAuthorization' | 'oauthStatus',
  block: Block,
  params: DataMap,
  readonly: boolean
) {
  if (block.getProperty('auth', false)?._bindingPath !== '~auth.#output') {
    throw new Error('Client has no embedded auth block');
  }
  const embedded = block.getValue('~auth');
  if (!(embedded instanceof Block)) {
    throw new Error('Client has no embedded auth block');
  }
  if (!globalFunctions.getDesc(embedded._funcId)?.commands?.[command]) {
    throw new Error('Authentication method does not support authorization');
  }
  return embedded.executeCommand(command, params, readonly);
}

export const clientAuthApi: FunctionApi = {
  commands: {
    startAuthorization: (block, params, readonly) =>
      forwardEmbeddedAuthCommand('startAuthorization', block, params, readonly),
    oauthStatus: (block, params, readonly) => forwardEmbeddedAuthCommand('oauthStatus', block, params, readonly),
  },
};
