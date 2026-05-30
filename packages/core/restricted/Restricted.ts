import type {DataMap} from '../util/DataTypes.js';

export class Restricted {
  allowPaths?: string[];
  denyPaths?: string[];
  allowCmds?: string[];
  denyCmds?: string[];
  // affect setValue updateValue setBinding addFlow addFlowFolder
  allowProps?: string[];
  denyProps?: string[];

  isRestricted(data: DataMap): string | null {
    if (!data) {
      return null;
    }
    const cmd = typeof data.cmd === 'string' ? data.cmd : null;
    if (cmd) {
      if (this.denyCmds?.includes(cmd)) {
        return 'restricted command';
      }
      if (this.allowCmds && !this.allowCmds.includes(cmd)) {
        return 'restricted command';
      }
    }

    const path = typeof data.path === 'string' ? data.path : null;
    if (path) {
      if (matchPath(this.denyPaths, path)) {
        return 'restricted path';
      }
      if (this.allowPaths && !matchPath(this.allowPaths, path)) {
        return 'restricted path';
      }
    }

    if (cmd && path && propCmds.has(cmd)) {
      const prop = path.substring(path.lastIndexOf('.') + 1);
      if (matchProp(this.denyProps, path, prop)) {
        return 'restricted property';
      }
      if (this.allowProps && !matchProp(this.allowProps, path, prop)) {
        return 'restricted property';
      }
    }

    return null;
  }
}

const propCmds = new Set(['set', 'update', 'bind', 'addFlow', 'addFlowFolder']);

function matchPath(list: string[] | undefined, path: string): boolean {
  return list?.some((item) => path === item || path.startsWith(`${item}.`)) ?? false;
}

function matchProp(list: string[] | undefined, path: string, prop: string): boolean {
  return list?.some((item) => item === prop || item === path) ?? false;
}
