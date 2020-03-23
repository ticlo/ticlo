import React from 'react';
import {JsFunction} from '../../src/core/functions/script/Js';
import {Functions} from '../../src/core/block/Functions';
import {Block} from '../../src/core/block/Block';
import {TicloComp} from './TicloComp';
import {validateReactComponent} from './validateReactComponent';
import {elementConfigs} from './BaseElement';

export class JsxFunction extends JsFunction {
  readonly _comp: React.ReactNode;
  constructor(block: Block) {
    super(block);
    this._comp = <TicloComp key={block._blockId} block={block} />;
    this._data.output(this._comp);
  }

  parseFunction(script: string): Function {
    const Babel = (window as any).Babel;
    if (Babel) {
      let toTransform = `"use strict";function F_(React){${script}}`;
      script = Babel.transform(toTransform, {presets: ['es2017', 'react']}).code.substring(34);
    }
    return new Function('React', '__block__', script);
  }
  applyFunction(f: Function): any {
    let result = f.call(this._proxy, React, this._data);
    if (this._runFunction || typeof result !== 'function') {
      // output when runFunction is ready
      this._data.output(result, '#render');
      this._data.output(this._comp);
    }
    return result;
  }
}

Functions.add(
  JsxFunction,
  {
    name: 'jsx',
    configs: elementConfigs,
    properties: [
      {
        name: 'script',
        type: 'string',
        mime: 'text/jsx',
        visible: 'high',
      },
      {
        name: '#output',
        type: 'object',
        readonly: true,
      },
    ],
  },
  'react'
);
