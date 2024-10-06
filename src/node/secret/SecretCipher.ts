import {randomBytes, createCipheriv, createDecipheriv} from 'crypto';
import {Logger} from '@ticlo/core';

export class SecretCipher {
  readonly #key = Buffer.alloc(16, 0);
  static encodeBufferLen(len: number) {
    let n = len;
    const bytes: number[] = [n & 0x7f];
    while (n > 0x7f) {
      n >>= 7;
      bytes.push((n & 0x7f) + 0x80);
    }
    return Buffer.from(bytes);
  }
  static decodeBufferLen(buf: Uint8Array): [number, number] {
    let i = buf.length - 1;
    let len = 0;
    for (; i >= 0; --i) {
      const b = buf[i];
      len <<= 7;
      len += b & 0x7f;
      if (b <= 0x7f) {
        break;
      }
    }
    if (i < 0) {
      return [-1, -1];
    }
    return [len, buf.length - i];
  }
  constructor(key: string) {
    const keyBase = Buffer.from(key);
    const baseLen = keyBase.length + 1;
    for (let i = 0; i < 16; ++i) {
      const iBase = i % baseLen;
      if (iBase !== baseLen - 1) {
        this.#key[i] = keyBase[iBase];
      }
    }
  }

  encode(str: string): unknown {
    const cipher = createCipheriv('aes-128-cbc', this.#key, this.#key);
    const strByte = Buffer.from(str);
    const lenByte = SecretCipher.encodeBufferLen(strByte.length);
    // 3 ~ 18 bytes of salt to align with AES output data size, the input length need to be 16N - 1
    const saltLen = Math.ceil((strByte.length + 4) / 16) * 16 - 1 - strByte.length - lenByte.length;
    const randomByte = randomBytes(saltLen);
    const toEncrypt = Buffer.concat([randomByte, strByte, lenByte]);
    const result: Buffer[] = [];
    result.push(cipher.update(toEncrypt));
    result.push(cipher.final());
    return Buffer.concat(result);
  }

  decode(buf: unknown): string {
    if (buf instanceof Uint8Array) {
      try {
        const decipher = createDecipheriv('aes-128-cbc', this.#key, this.#key);
        const result: Buffer[] = [];
        result.push(decipher.update(buf));
        result.push(decipher.final());
        const decrypted = Buffer.concat(result);
        const [dataLen, tailLen] = SecretCipher.decodeBufferLen(decrypted);
        if (dataLen >= 0) {
          const dataBuf = decrypted.subarray(decrypted.length - dataLen - tailLen, decrypted.length - tailLen);
          return dataBuf.toString();
        }
      } catch (err) {
        Logger.error(`invalid secret ${err}`);
      }
    }
    return null;
  }
}
