import React from 'react';
import {JsFunction} from '../../core/functions/script/Js';
import {Types} from '../../core/block/Type';
import {Block} from '../../core/block/Block';
import {TicloComp} from './TicloComp';

export class RenderFunction extends JsFunction {
  readonly _comp: React.ReactNode;
  constructor(block: Block) {
    super(block);
    this._comp = <TicloComp key={block._blockId} block={block} />;
    block.output(this._comp);
    console.log(this._comp);
  }

  parseFunction(script: string): Function {
    return new Function('React', script);
  }
  applyFunction(f: Function): any {
    let result = f.call(this._proxy, React);
    if (this._runFunction || typeof result !== 'function') {
      // output when runFunction is ready
      this._data.output(result, '#render');
      this._data.output(this._comp);
    }
    return result;
  }
}

Types.add(
  RenderFunction,
  {
    name: 'render',
    icon: 'fab:react',
    properties: [
      {
        name: 'script',
        type: 'string',
        visible: 'high'
      },
      {
        name: 'output',
        type: 'map',
        readonly: true
      }
    ]
  },
  'react'
);
