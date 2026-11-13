import {aessiv} from '@noble/ciphers/aes.js';
import {bytesToHex, hexToBytes} from '@noble/ciphers/utils.js';
import {Logger, setSecretCipher} from '@ticlo/core';

const encoder = new TextEncoder();
const decoder = new TextDecoder();
// SHA-256 of the fixed browser password "ticlo".
const wrappingKey = hexToBytes('ff4c67eaa14b56bfd7584bb70a657eea4aadb539a7b74ba7148086a23e16633a');
const storageKey = 'ticlo-browser-secret-key';
const secretContext = encoder.encode('#secret');

function loadKey() {
  const cipher = aessiv(wrappingKey);
  const saved = localStorage.getItem(storageKey);
  if (saved !== null) return cipher.decrypt(hexToBytes(saved));

  const key = crypto.getRandomValues(new Uint8Array(32));
  localStorage.setItem(storageKey, bytesToHex(cipher.encrypt(key)));
  return key;
}

export async function initBrowserSecretCipher(): Promise<void> {
  // Coordinate first use across tabs so they save secrets with the same key.
  const key = navigator.locks ? await navigator.locks.request(storageKey, loadKey) : loadKey();
  setSecretCipher({
    // Stable ciphertext lets Flow history compare repeated snapshots of the same secret.
    encode(value) {
      if (typeof value === 'string') return aessiv(key, secretContext).encrypt(encoder.encode(value));
    },
    decode(value) {
      if (!(value instanceof Uint8Array)) return undefined;
      try {
        return decoder.decode(aessiv(key, secretContext).decrypt(value));
      } catch {
        Logger.warn('Unable to decrypt browser Block secret');
        return value;
      }
    },
  });
}
