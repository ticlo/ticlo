export function mapPointsBetweenElement(
  fromElement: HTMLElement,
  toElement: HTMLElement,
  fromX: number,
  fromY: number
): [number, number] {
  let rectfrom = fromElement.getBoundingClientRect();
  let {x, y} = rectfrom;
  if (fromX !== 0) {
    x += (fromX * rectfrom.width) / fromElement.offsetWidth;
  }
  if (fromY !== 0) {
    y += (fromY * rectfrom.height) / fromElement.offsetHeight;
  }
  let rectLayout = toElement.getBoundingClientRect();
  x -= rectLayout.x;
  y -= rectLayout.y;
  x *= toElement.offsetWidth / rectLayout.width;
  y *= toElement.offsetHeight / rectLayout.height;
  return [x, y];
}
