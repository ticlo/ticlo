export const httpAuthProfiles = new WeakMap<object, {origin: string; token(context: unknown): Promise<string>}>();

export class HttpAuthRequired extends Error {
  constructor() {
    super('HTTP authorization required');
    this.name = 'authorization-required';
  }
}

export function isBearerToken(value: unknown): value is string {
  return typeof value === 'string' && /^[a-zA-Z0-9._~+/-]+=*$/.test(value);
}

export function authUrl(value: string) {
  const url = new URL(value);
  if (
    url.username ||
    url.password ||
    url.hash ||
    (url.protocol !== 'https:' &&
      !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))
  )
    throw new Error('Invalid authorization URL');
  return url;
}
