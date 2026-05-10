export function getDescLib(funcId: unknown, funcLib?: string): string | undefined {
  return typeof funcId === 'string' && funcId.startsWith(':') ? funcLib : undefined;
}
