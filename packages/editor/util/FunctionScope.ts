export function getDescScope(funcId: unknown, funcScope?: string): string | undefined {
  return typeof funcId === 'string' && funcId.startsWith(':') ? funcScope : undefined;
}
