export function resolve(path1: string, path2: string): string {
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
