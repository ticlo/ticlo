import {aessiv} from '@noble/ciphers/aes.js';
import {bytesToHex, hexToBytes} from '@noble/ciphers/utils.js';
import {setSecretCipher} from '@ticlo/core';

const encoder = new TextEncoder();
const decoder = new TextDecoder();
// SHA-256 of the fixed browser password "ticlo".
const wrappingKey = hexToBytes('ff4c67eaa14b56bfd7584bb70a657eea4aadb539a7b74ba7148086a23e16633a');
const passwordSalt = encoder.encode('ticlo');
const secretContext = encoder.encode('#secret');
const format = encoder.encode('TicloSecret\x01');
const idSize = 8;
const passwordStorage = 'ticlo-browser-secret-passwords';
const legacyStorage = 'ticlo-browser-secret-key';

interface Passwords {
  primary?: string;
  keys: Map<string, Uint8Array>;
}

let savedPasswords: string | null | undefined;
let passwords: Passwords = {keys: new Map()};
let legacyKey: Uint8Array | undefined;

function readPasswords() {
  const saved = localStorage.getItem(passwordStorage);
  if (saved === savedPasswords) return passwords;
  if (saved === null) {
    passwords = {keys: new Map()};
  } else {
    const {primary, keys} = JSON.parse(saved) as {primary?: string; keys: [string, string][]};
    passwords = {
      primary,
      keys: new Map(keys.map(([id, key]) => [id, aessiv(wrappingKey).decrypt(hexToBytes(key))])),
    };
  }
  savedPasswords = saved;
  return passwords;
}

function updatePasswords(update: (passwords: Passwords) => void) {
  const write = () => {
    const {keys, primary} = readPasswords();
    const next: Passwords = {keys: new Map(keys), primary};
    update(next);
    const data = JSON.stringify({
      primary: next.primary,
      keys: [...next.keys].map(([id, key]) => [id, bytesToHex(aessiv(wrappingKey).encrypt(key))]),
    });
    localStorage.setItem(passwordStorage, data);
    passwords = next;
    savedPasswords = data;
  };
  if (navigator.locks) return navigator.locks.request(passwordStorage, write);
  write();
}

export function listSecretPasswords() {
  const {keys, primary} = readPasswords();
  return {ids: [...keys.keys()], primary};
}

export async function addSecretPassword(password: Uint8Array<ArrayBuffer>): Promise<string> {
  let source: CryptoKey;
  try {
    source = await crypto.subtle.importKey('raw', password, 'PBKDF2', false, ['deriveBits']);
  } finally {
    password.fill(0);
  }
  const key = new Uint8Array(
    await crypto.subtle.deriveBits(
      {name: 'PBKDF2', hash: 'SHA-256', salt: passwordSalt, iterations: 600_000},
      source,
      256
    )
  );
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', key));
  const id = bytesToHex(hash.subarray(0, idSize));
  await updatePasswords((passwords) => {
    const existing = passwords.keys.get(id);
    if (existing && !existing.every((byte, index) => byte === key[index])) throw new Error('Password ID collision');
    passwords.keys.set(id, key);
    if (!passwords.keys.has(passwords.primary)) passwords.primary = id;
  });
  return id;
}

export async function setPrimarySecretPassword(id: string) {
  await updatePasswords((passwords) => {
    if (passwords.keys.has(id)) passwords.primary = id;
  });
}

export async function removeSecretPassword(id: string) {
  await updatePasswords((passwords) => {
    passwords.keys.delete(id);
    if (passwords.primary === id) passwords.primary = passwords.keys.keys().next().value;
  });
}

type SecretNotice = {type: 'primary'} | {type: 'decrypt'; ids: string[]};
const listeners = new Set<(notice: SecretNotice) => void>();
let pendingPrimary = false;
let failedIds = new Set<string>();
let noticeQueued = false;

function scheduleNotices() {
  if (noticeQueued || !listeners.size) return;
  noticeQueued = true;
  queueMicrotask(() => {
    noticeQueued = false;
    if (!listeners.size) return;
    const primary = pendingPrimary;
    const ids = [...failedIds];
    pendingPrimary = false;
    failedIds = new Set();
    for (const listener of listeners) {
      if (primary) listener({type: 'primary'});
      if (ids.length) listener({type: 'decrypt', ids});
    }
  });
}

export function onBrowserSecretNotice(listener: (notice: SecretNotice) => void) {
  listeners.add(listener);
  scheduleNotices();
  return () => {
    listeners.delete(listener);
  };
}

function hasSecretHeader(data: Uint8Array) {
  return data.length >= format.length + 16 + idSize && format.every((byte, index) => data[index] === byte);
}

const browserCipher = {
  encode(value: string) {
    const {keys, primary} = readPasswords();
    const key = keys.get(primary);
    if (!key) {
      pendingPrimary = true;
      scheduleNotices();
      return undefined;
    }
    const id = hexToBytes(primary);
    const encrypted = aessiv(key, secretContext, format, id).encrypt(encoder.encode(value));
    const result = new Uint8Array(format.length + encrypted.length + idSize);
    result.set(format);
    result.set(encrypted, format.length);
    result.set(id, format.length + encrypted.length);
    return result;
  },
  decode(value: unknown) {
    if (!(value instanceof Uint8Array)) return undefined;
    let id = '';
    try {
      if (hasSecretHeader(value)) {
        const suffix = value.subarray(-idSize);
        id = bytesToHex(suffix);
        const key = readPasswords().keys.get(id);
        if (key) {
          return decoder.decode(
            aessiv(key, secretContext, format, suffix).decrypt(value.subarray(format.length, -idSize))
          );
        }
      } else if (legacyKey) {
        return decoder.decode(aessiv(legacyKey, secretContext).decrypt(value));
      }
    } catch {
      // Report authentication failures together with missing keys.
    }
    failedIds.add(id);
    scheduleNotices();
    return undefined;
  },
};

export async function initBrowserSecretCipher(): Promise<void> {
  try {
    const legacy = localStorage.getItem(legacyStorage);
    legacyKey = legacy === null ? undefined : aessiv(wrappingKey).decrypt(hexToBytes(legacy));
  } catch {
    legacyKey = undefined;
  }
  setSecretCipher(browserCipher);
}
