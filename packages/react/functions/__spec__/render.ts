import {createRoot, Root} from 'react-dom/client';
import {act, ReactNode} from 'react';

export class ReactRoot {
  constructor(
    public div: HTMLDivElement,
    public root: Root
  ) {}

  async waitRender(node?: ReactNode) {
    const environment = globalThis as {IS_REACT_ACT_ENVIRONMENT?: boolean};
    const previous = environment.IS_REACT_ACT_ENVIRONMENT;
    environment.IS_REACT_ACT_ENVIRONMENT = true;
    try {
      await act(async () => {
        if (node) this.root?.render(node);
        // Allow updates scheduled before act() to enter React's work queue.
        await new Promise((resolve) => setTimeout(resolve));
      });
    } finally {
      environment.IS_REACT_ACT_ENVIRONMENT = previous;
    }
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
