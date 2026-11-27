import {NoSerialize} from '../../util/NoSerialize.ts';

export type TlsClientIdentity = Readonly<NoSerialize>;

const identities = new WeakMap<TlsClientIdentity, {cert: string; key: string}>();

/** Create a host-owned identity for a connector to use when opening a TLS connection. */
export function createTlsClientIdentity(cert: string, key: string): TlsClientIdentity {
  const identity = Object.freeze(new NoSerialize('auth:tls-client-identity'));
  identities.set(identity, {cert, key});
  return identity;
}

export function getTlsClientIdentity(identity: TlsClientIdentity) {
  const credentials = identities.get(identity);
  if (!credentials) throw new Error('Invalid TLS client identity');
  return credentials;
}
