import {Logger} from './Logger';
import {type Block} from '../block/Block';

export function splitPathName(currentPath: string): [string, string] {
  let dotPos = currentPath.lastIndexOf('.');
  if (dotPos > -1) {
    return [currentPath.substring(0, dotPos), currentPath.substring(dotPos + 1)];
  }
  return ['', currentPath];
}

export function resolvePath(currentPath: string, relativePath: string): string {
  if (relativePath == null) {
    return null;
  }
  let p1 = currentPath.split('.');
  let p2 = relativePath.split('.');

  loopwhile: while (p2.length > 0 && p1.length > 0) {
    switch (p2[0]) {
      case '##':
        // parent path
        p1.pop();
      /* falls through */
      case '#':
        // shift is slow, but this should not be a common thing in binding
        p2.shift();
        break;
      case '###':
        // stage path can't be resolved just from the path string, can not resolve
        Logger.warn(`can not resolve base path ${currentPath} with ${relativePath}`);
        return relativePath;
      default:
        break loopwhile;
    }
  }
  return p1.concat(p2).join('.');
}

export function getRelativePath(base: string, from: string): string {
  if (base === from) {
    return '';
  }
  let p1 = base.split('.');
  let p2 = from.split('.');
  let pos = 0;
  while (p1[pos] === p2[pos]) {
    ++pos;
  }
  let str2 = p2.slice(pos).join('.');
  return str2.padStart(str2.length + (p1.length - pos) * 3, '##.');
}

// call all paths in between, including the target path but not the base path
// callback: return true to break
export function forAllPathsBetween(target: string, base: string, callback: (value: string) => boolean) {
  if (!target.startsWith(base)) {
    return false;
  }
  if (callback(target)) {
    return true;
  }
  let targetParts = target.split('.');
  let baseParts = base.split('.');

  for (let len = targetParts.length - 1; len > baseParts.length; --len) {
    if (callback(targetParts.slice(0, len).join('.'))) {
      return true;
    }
  }
  return false;
}

const invalidNameReg = /[\u0000-\u0019\\/?*:|"<>]/;
const encodeNameReg = /[\u0000-\u0019\\/?*:|"<>]/g;
const invalidPathReg = /[\u0000-\u0019\\/?*:|"<>.]/;
export function validateNodeName(name: string) {
  return name?.search(invalidNameReg) < 0;
}
export function validateNodePath(path: string) {
  return path.search(invalidPathReg) < 0;
}

// Escape single byte character, faster than escape or encodeURIComponent.
function escapeChar(s: string) {
  const c = s.charCodeAt(0);
  if (c < 16) {
    return `%0${c.toString(16)}`;
  } else {
    return `%${c.toString(16)}`;
  }
}

export function encodeFileName(path: string) {
  return path.replace(encodeNameReg, escapeChar);
}

/**
 * Whether this binding is allowed.
 */
export function isBindable(toPath: string, fromPath: string): boolean | 'shared' {
  if (toPath === fromPath) {
    return false;
  }
  let tpScope = toPath.substring(0, toPath.indexOf('.'));
  let fromScope = fromPath.substring(0, fromPath.indexOf('.'));
  if (tpScope !== fromScope) {
    if ((tpScope === '#shared' || tpScope === '#temp') && fromScope !== '#global') {
      return false;
    }
    if (fromScope === '#shared' || fromScope === '#temp') {
      return false;
    }
  }
  let fromSharedPos = fromPath.lastIndexOf('.#shared.');
  let toSharedPos = toPath.lastIndexOf('.#shared.');
  if (toSharedPos > fromSharedPos) {
    return false;
  }
  if (fromSharedPos > 0) {
    if (!toPath.startsWith(fromPath.substring(0, fromSharedPos + 1))) {
      return false;
    }
    if (fromSharedPos !== toSharedPos) {
      return 'shared';
    }
  }
  return true;
}

export function getBlockStoragePath(block: Block) {
  // get the storage path for subflow
  let fullPath = block.getFullPath();
  if (fullPath.includes('#flows.')) {
    fullPath = fullPath.replaceAll(/#flows\.[^.]+/g, '#flows._');
  }
  return `${fullPath}.#`;
}
