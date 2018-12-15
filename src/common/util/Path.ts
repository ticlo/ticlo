export function resolve(path1: string, path2: string): string {
  if (path2 == null) {
    return null;
  }
  let p1 = path1.split('.');
  let p2 = path2.split('.');

  loopwhile:
    while (p2.length > 0 && p1.length > 0) {
      switch (p2[0]) {
        case '##':
          // parent path
          p1.pop();
        /* falls through */
        case '#':
          p2.shift();
          break;
        case '###':
          // stage path can't be resolved just from the path string, can not concat
          // TODO need a better solution to show binding wire
          return path2;
        default:
          break loopwhile;
      }
    }
  return p1.concat(p2).join('.');
}

export function relative(from: string, to: string): string {
  if (from === to) {
    return '';
  }
  let p1 = from.split('.');
  let p2 = to.split('.');
  let pos = 0;
  while (p1[pos] === p2[pos]) {
    ++pos;
  }
  let str2 = p2.slice(pos).join('.');
  return str2.padStart(str2.length + (p1.length - pos) * 3, '##.');
}

export function allPathsBetween(target: string, base: string): string[] {
  if (target === base || !target.startsWith(base)) {
    return [];
  }
  let targetParts = target.split('.');
  let baseParts = base.split('.');
  let results: string[] = [];
  for (let len = targetParts.length - 1; len > baseParts.length; --len) {
    results.push(targetParts.slice(0, len).join('.'));
  }
  return results;
}