import ReactDOM from 'react-dom';
import {BaseFunction} from '../../core/block/BlockFunction';
import {Types} from '../../core/block/Type';

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
      ReactDOM.render(component, container);
    }
  }

  destroy(): void {
    if (this._container) {
      ReactDOM.render(null, this._container);
    }
    super.destroy();
  }
}

Types.add(
  RenderDomFunction,
  {
    name: 'render-dom',
    icon: 'fab:react',
    properties: [
      {name: 'container', type: 'map'},
      {name: 'component', type: 'map'}
    ]
  },
  'react'
);
