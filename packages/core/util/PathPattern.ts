/** `*` stays within a segment; `**` spans segments; `?` matches one or more digits (0-9).
 * A trailing `.**` requires a descendant, so `Main.**` does not match `Main` itself.
 */
export function matchPathPattern(pattern: string, path: string): boolean {
  const patterns = pattern.split('.');
  const parts = path.split('.');
  const memo = new Map<string, boolean>();
  function match(i: number, j: number): boolean {
    const key = `${i}:${j}`;
    if (memo.has(key)) return memo.get(key);
    let result: boolean;
    if (i === patterns.length) {
      result = j === parts.length;
    } else if (patterns[i] === '**') {
      result = i === patterns.length - 1 ? j < parts.length : match(i + 1, j) || (j < parts.length && match(i, j + 1));
    } else {
      const expression = patterns[i].replace(/[.*+?^${}()|[\]\\]/g, (char) =>
        char === '*' ? '.*' : char === '?' ? '[0-9]+' : `\\${char}`
      );
      result = j < parts.length && new RegExp(`^${expression}$`).test(parts[j]) && match(i + 1, j + 1);
    }
    memo.set(key, result);
    return result;
  }
  return match(0, 0);
}
