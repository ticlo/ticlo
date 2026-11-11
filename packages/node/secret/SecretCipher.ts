import {createCipheriv, createDecipheriv, randomBytes, randomUUID} from 'node:crypto';
import {link, readFile, unlink, writeFile} from 'node:fs/promises';
import {Logger} from '@ticlo/core';

const keySize = 32;
const nonceSize = 12;
const tagSize = 16;

export class SecretCipher {
  readonly #key: Buffer;

  constructor(key: Uint8Array) {
    if (key.byteLength !== keySize) throw new Error('A 32-byte secret key is required');
    this.#key = Buffer.from(key);
  }

  static async fromFile(path: string): Promise<SecretCipher> {
    try {
      return new SecretCipher(await readFile(path));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }

    const temporaryPath = `${path}.${randomUUID()}.key`;
    await writeFile(temporaryPath, randomBytes(keySize), {flag: 'wx', mode: 0o600});
    try {
      // Publish the complete key without replacing a key created by another process.
      await link(temporaryPath, path);
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    } finally {
      await unlink(temporaryPath);
    }
    return new SecretCipher(await readFile(path));
  }

  encode(value: string): Uint8Array | undefined {
    if (typeof value !== 'string') return undefined;
    const nonce = randomBytes(nonceSize);
    const cipher = createCipheriv('aes-256-gcm', this.#key, nonce, {authTagLength: tagSize});
    const data = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const encrypted = Buffer.concat([nonce, cipher.getAuthTag(), data]);
    return new Uint8Array(encrypted.buffer, encrypted.byteOffset, encrypted.byteLength);
  }

  decode(value: unknown): string | undefined {
    if (!(value instanceof Uint8Array) || value.byteLength < nonceSize + tagSize) return undefined;
    const nonce = value.subarray(0, nonceSize);
    const tag = value.subarray(nonceSize, nonceSize + tagSize);
    try {
      const cipher = createDecipheriv('aes-256-gcm', this.#key, nonce, {authTagLength: tagSize});
      cipher.setAuthTag(tag);
      return Buffer.concat([cipher.update(value.subarray(nonceSize + tagSize)), cipher.final()]).toString('utf8');
    } catch {
      Logger.warn('Unable to decrypt Block secret');
      return undefined;
    }
  }
}
