import ReactDOM from 'react-dom';
import {BaseFunction} from '../../src/core/block/BlockFunction';
import {Functions} from '../../src/core/block/Functions';

export class RenderDomFunction extends BaseFunction {
  _container: Element;
  run(): any {
    let container = this._data.getValue('container');
    let component = this._data.getValue('component');

    if (!(container instanceof Element)) {
      container = null;
    }
    if (this._container && container !== this._container) {
      ReactDOM.render(null, this._container);
    }
    this._container = container;
    if (container) {
      return new Promise((resolve) => {
        ReactDOM.render(component, container, resolve);
      });
    }
  }

  destroy(): void {
    if (this._container) {
      ReactDOM.render(null, this._container);
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
