import React from 'react';
import {Functions} from '../../src/core/block/Functions';
import {BlockFunction} from '../../src/core/block/BlockFunction';
import {Block} from '../../src/core/block/Block';
import {TicloComp} from './TicloComp';
import {configDescs, FunctionDesc, PropDesc, PropGroupDesc} from '../../src/core/block/Descriptor';
import {BlockIO} from '../../src/core/block/BlockProperty';
import {HtmlElementFunction} from './BaseElement';

const childrenPropertyGroup: PropGroupDesc = {
  name: '',
  type: 'group',
  defaultLen: 0,
  properties: [{name: '', type: 'any'}]
};
const commonProperties: PropDesc[] = [
  {
    name: '#output',
    type: 'object',
    readonly: true
  }
];
const divElementDesc: FunctionDesc = {
  name: 'div',
  base: 'react:element',
  configs: ['#call', '#mode', '#priority', '#sync', '#render'],
  properties: [childrenPropertyGroup, ...commonProperties],
  category: 'react:elements'
};

export class DivElementFunction extends HtmlElementFunction {
  getComponent(): any {
    return 'div';
  }
}

Functions.add(DivElementFunction, divElementDesc, 'react');

//
// class SpanElementFunction extends DivElementFunction {
//   getComponent(): any {
//     return 'span';
//   }
// }
// Functions.add(SpanElementFunction, {...divElementDesc, name: 'span'}, 'react');
//
// class PElementFunction extends DivElementFunction {
//   getComponent(): any {
//     return 'p';
//   }
// }
// Functions.add(PElementFunction, {...divElementDesc, name: 'p'}, 'react');
//
// class PreElementFunction extends DivElementFunction {
//   getComponent(): any {
//     return 'pre';
//   }
// }
// Functions.add(PreElementFunction, {...divElementDesc, name: 'pre'}, 'react');
//
// class ButtonElementFunction extends DivElementFunction {
//   getComponent(): any {
//     return 'button';
//   }
// }
// Functions.add(ButtonElementFunction, {...divElementDesc, name: 'button'}, 'react');
//
// class AElementFunction extends DivElementFunction {
//   getComponent(): any {
//     return 'a';
//   }
//
//   getProps(): {[p: string]: any} {
//     return {...super.getProps(), href: this._data.getValue('href'), target: this._data.getValue('target')};
//   }
// }
// Functions.add(
//   AElementFunction,
//   {
//     name: 'a',
//     icon: 'fab:react',
//     properties: [
//       childrenPropertyGroup,
//       {
//         name: 'href',
//         type: 'string',
//         visible: 'high'
//       },
//       {
//         name: 'target',
//         type: 'combo-box',
//         options: ['_blank', '_self', '_parent', '_top'],
//         visible: 'low'
//       },
//       ...commonProperties
//     ]
//   },
//   'react'
// );
