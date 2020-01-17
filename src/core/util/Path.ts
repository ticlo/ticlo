import {Logger} from './Logger';

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

const invalidNameReg = /[\\\/?*:|"<>]/;
const invalidPathReg = /[\\\/?*:|"<>.]/;
export function validateNodeName(name: string) {
  return name.search(invalidNameReg) < 0;
}
export function validateNodePath(path: string) {
  return path.search(invalidPathReg) < 0;
}
