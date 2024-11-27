import {createRoot, Root} from 'react-dom/client';
import {Root as TicloRoot} from '@ticlo/core';
import {ReactNode} from 'react';
import {setScheduledTimeout} from '@ticlo/core/util/SetSchedule';

export class ReactRoot {
  constructor(
    public div: HTMLDivElement,
    public root: Root
  ) {}

  waitRender(node?: ReactNode) {
    if (node) {
      this.root?.render(node);
    }
    return new Promise((resolve) => {
      setTimeout(function () {
        requestAnimationFrame(resolve);
      });
    });
  }
  remove() {
    this.root?.unmount();
    this.div.remove();
  }
}

export function creatReactRoot(initReact = true) {
  const div = document.createElement('div');
  div.style.position = 'absolute';
  div.style.width = '800px';
  div.style.height = '800px';
  return new ReactRoot(div, initReact ? createRoot(div) : null);
}
