export function getDescLib(funcId: unknown, funcLib?: string): string | undefined {
  return typeof funcId === 'string' && funcId.startsWith(':') ? funcLib : undefined;
}

export function getFuncLibPath(value: unknown, fallback?: string): string | undefined {
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
