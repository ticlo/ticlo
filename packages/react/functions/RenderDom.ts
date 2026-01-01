import type React from 'react';
import {createRoot, Root} from 'react-dom/client';
import {BaseFunction, PureFunction} from '@ticlo/core/block/BlockFunction.js';
import {Functions} from '@ticlo/core/block/Functions.js';

export class RenderDomFunction extends BaseFunction {
  _container: Element;
  _root: Root;
  run(): any {
    let container = this._data.getValue('container') as Element;
    const component = this._data.getValue('component') as React.ReactNode;

    // TODO validate component?

    if (!(container instanceof Element)) {
      container = null;
    }
    if (container !== this._container) {
      if (this._root) {
        this._root.unmount();
      }
      if (container) {
        this._root = createRoot(container);
      } else {
        this._root = null;
      }
    }
    this._container = container;

    if (this._root) {
      return new Promise((resolve) => {
        this._root.render(component);
        window.requestIdleCallback(resolve, {timeout: 200});
      });
    }
  }
  cleanup() {
    if (this._root) {
      this._root.unmount();
    }
  }

  destroy(): void {
    if (this._root) {
      this._root.unmount();
    }
    super.destroy();
  }
}

Functions.add(
  RenderDomFunction,
  {
    name: 'render-dom',
    icon: 'fab:react',
    properties: [
      {name: 'container', type: 'object'},
      {name: 'component', type: 'object'},
    ],
  },
  'react'
);
