interface MouseEvent {
  pageX: number;
  pageY: number;
}


export function getInitDragState(e: MouseEvent, element: HTMLElement): [number, number, number, number] {
  let rect = element.getBoundingClientRect();
  let scalex = element.offsetWidth / rect.width;
  let scaley = element.offsetHeight / rect.height;
  return [e.pageX, e.pageY, scalex, scaley];
}

export function getCurrentDragOffset(e: MouseEvent, initState: [number, number, number, number]): [number, number] {
  let [basex, basey, scalex, scaley] = initState;
  return [(e.pageX - basex) * scalex, (e.pageY - basey) * scaley]
}
