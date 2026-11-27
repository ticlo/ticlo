import {PureFunction} from '../../block/BlockFunction.ts';
import {globalFunctions} from '../../block/FunctionModule.ts';

export interface AuthProfile {
  readonly authMode: string;
  readonly showSecret: boolean;
}

export function resolvePasswordAuth(profile: unknown, getSecret: () => string | undefined): string | undefined {
  if (profile == null) return undefined;
  if (typeof profile !== 'object') throw new Error('Invalid auth profile');
  const {authMode, showSecret} = profile as AuthProfile;
  if (typeof authMode !== 'string' || typeof showSecret !== 'boolean') {
    throw new Error('Invalid auth profile');
  }
  if (authMode !== 'password') throw new Error('Unsupported auth mode');
  const password = getSecret();
  if (password === undefined) throw new Error('Password authentication requires #secret');
  return password;
}

const passwordProfile: AuthProfile = Object.freeze({authMode: 'password', showSecret: true});

class PasswordAuth extends PureFunction {
  run() {
    this._data.output(passwordProfile);
  }
}

globalFunctions.addFactory(
  PasswordAuth,
  {
    name: 'password',
    mode: 'onLoad',
    priority: 0,
    tags: ['auth-profile', 'context-service'],
    properties: [{name: '#output', type: 'object', readonly: true, pinned: true}],
  },
  'auth'
);
