import React from 'react';
import {BaseFunction} from '../../core/block/BlockFunction';
import {JsFunction} from '../../core/functions/script/Js';
import {BlockIO} from '../../core/block/BlockProperty';
import {Types} from '../../core/block/Type';
import {RenderDomFunction} from './RenderDom';

let reactTypeSymbol = (React.createElement('div') as any).$$typeof;

export class RenderFunction extends JsFunction {
  // inputChanged(input: BlockIO, val: any): boolean {
  //   let result = super.inputChanged(input, val);
  //   if (result && input._name === 'script') {
  //     return true;
  //   }
  //   // ignore default function trigger, use its own listener
  //   return false;
  // }

  parseFunction(script: string): Function {
    return new Function('React', script);
  }
  applyFunction(f: Function): any {
    let result = f.call(this._proxy, React);
    if (result.$$typeof === reactTypeSymbol) {
      this._data.output(result);
    } else if (this._runFunction || typeof result !== 'function') {
      // clear output only when runFunction is ready
      this._data.output(undefined);
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
