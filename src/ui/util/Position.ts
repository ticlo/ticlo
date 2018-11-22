export function getOffsetXY(current: HTMLElement, target: HTMLElement, x: number, y: number): [number, number] {
  while (current !== target) {
    x += current.offsetLeft;
    y += current.offsetTop;
    current = current.parentElement;
    if (!current) {
      return [NaN, NaN];
    }
    x += current.clientLeft;
    y += current.clientTop;
  }
  return [x, y];
}
