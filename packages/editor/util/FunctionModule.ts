import {Block} from '@ticlo/core';

export function getDescModule(funcId: unknown, funcModule?: string): string | undefined {
  return typeof funcId === 'string' && funcId.startsWith(':') ? funcModule : undefined;
}

export function getFuncModulePath(value: unknown, fallback?: string): string | undefined {
  if (value instanceof Block) return value.getFullPath();
  if (typeof value === 'string') {
    return value;
  }
  if (value && typeof value === 'object') {
    const noSerialize = value as {type?: unknown; value?: unknown};
    if (noSerialize.type === 'Block' && typeof noSerialize.value === 'string') {
      return noSerialize.value;
    }
  }
  return fallback;
}
