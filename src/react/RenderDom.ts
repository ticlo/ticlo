import {createRoot, Root} from 'react-dom/client';
import {PureFunction} from '../../src/core/block/BlockFunction';
import {Functions} from '../../src/core/block/Functions';

export class RenderDomFunction extends PureFunction {
  _container: Element;
  _root: Root;
  run(): any {
    let container = this._data.getValue('container');
    let component = this._data.getValue('component');

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
