import {mkdir, readFile, rename, rm, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import type {OAuthGrant} from './OAuth.ts';
import type {OAuthGrantStore} from './OAuthRoutes.ts';

/** Store deployment grants outside all flow and file-server storage scopes. */
export function createFileOAuthGrantStore(
  directory: string,
  cipher: {encode(value: string): Uint8Array | undefined; decode(value: Uint8Array): string | undefined}
): OAuthGrantStore {
  const path = (key: string) => {
    if (!/^[a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+)*$/.test(key)) throw new Error('Invalid OAuth grant key');
    return join(directory, key);
  };
  return {
    async get(key) {
      try {
        const decoded = cipher.decode(await readFile(path(key)));
        if (!decoded) throw new Error('Unable to decrypt OAuth grant');
        return JSON.parse(decoded) as OAuthGrant;
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
    },
    async set(key, grant) {
      const destination = path(key);
      if (!grant) {
        await rm(destination, {force: true});
        return;
      }
      await mkdir(directory, {recursive: true, mode: 0o700});
      const temporary = `${destination}.${randomUUID()}.tmp`;
      try {
        await writeFile(temporary, cipher.encode(JSON.stringify(grant)), {flag: 'wx', mode: 0o600});
        await rename(temporary, destination);
      } finally {
        await rm(temporary, {force: true});
      }
    },
  };
}
