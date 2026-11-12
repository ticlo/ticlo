import {randomBytes} from 'node:crypto';
import {mkdtemp, rm, stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {SecretCipher} from '../SecretCipher.ts';

it('encrypts secrets with a fresh nonce and rejects tampering and the wrong key', () => {
  const cipher = new SecretCipher(randomBytes(32));
  const value = '密钥 🔑';
  const encrypted = cipher.encode(value);
  expect(cipher.decode(encrypted)).toBe(value);
  expect(cipher.encode(value)).not.toEqual(encrypted);
  expect(new SecretCipher(randomBytes(32)).decode(encrypted)).toBeUndefined();
  encrypted[encrypted.length - 1] ^= 1;
  expect(cipher.decode(encrypted)).toBeUndefined();
});

it('reuses the same host key across concurrent startup and restart', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ticlo-secret-key-'));
  try {
    const path = join(dir, '.ticlo-secret.key');
    const [first, second] = await Promise.all([SecretCipher.fromFile(path), SecretCipher.fromFile(path)]);
    const encrypted = first.encode('password');
    expect(second.decode(encrypted)).toBe('password');
    const restarted = await SecretCipher.fromFile(path);
    expect(restarted.decode(encrypted)).toBe('password');
    if (process.platform !== 'win32') expect((await stat(path)).mode & 0o077).toBe(0);
  } finally {
    await rm(dir, {recursive: true, force: true});
  }
});
