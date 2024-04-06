import {expect} from 'vitest';
import {SecretCipher} from '../SecretCipher';

describe('SecretCipher', function () {
  it('encode length', function () {
    expect([...SecretCipher.encodeBufferLen(18)]).toEqual([18]);
    expect([...SecretCipher.encodeBufferLen(0x80)]).toEqual([0, 0x81]);
    expect([...SecretCipher.encodeBufferLen(0xff)]).toEqual([0x7f, 0x81]);
    expect([...SecretCipher.encodeBufferLen(0xffff)]).toEqual([0x7f, 0xff, 0x83]);
  });

  it('decode length', function () {
    expect(SecretCipher.decodeBufferLen(new Uint8Array([18]))).toEqual([18, 1]);
    expect(SecretCipher.decodeBufferLen(new Uint8Array([0, 0x81]))).toEqual([0x80, 2]);
    expect(SecretCipher.decodeBufferLen(new Uint8Array([0x7f, 0x81]))).toEqual([0xff, 2]);
    expect(SecretCipher.decodeBufferLen(new Uint8Array([0x7f, 0xff, 0x83]))).toEqual([0xffff, 3]);

    expect(SecretCipher.decodeBufferLen(new Uint8Array([0x80]))).toEqual([-1, -1]);
  });

  it('encode data with different length', function () {
    const key = '123';
    for (let i = 0; i < 130; ++i) {
      const s = ''.padStart(i, String.fromCharCode(Math.round(Math.random() * 80 + 32)));
      const cipher = new SecretCipher(key);
      const encrypted = cipher.encode(s);
      const decrypted = cipher.decode(encrypted);
      expect(decrypted).toBe(s);
    }
  });
  it('encode data with different key length', function () {
    for (let i = 1; i < 18; ++i) {
      const s = ''.padStart(i, String.fromCharCode(Math.round(Math.random() * 80 + 32)));
      const cipher = new SecretCipher(s);
      const encrypted = cipher.encode(s);
      const decrypted = cipher.decode(encrypted);
      expect(decrypted).toBe(s);
    }
  });
});
