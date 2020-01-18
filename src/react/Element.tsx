import React from 'react';
import {Functions} from '../../src/core/block/Functions';
import {BlockFunction} from '../../src/core/block/BlockFunction';
import {Block} from '../../src/core/block/Block';
import {TicloComp} from './TicloComp';
import {FunctionDesc, PropDesc, PropGroupDesc} from '../../src/core/block/Descriptor';
import {BlockIO} from '../../src/core/block/BlockProperty';

const childrenPropertyGroup: PropGroupDesc = {
  name: '',
  type: 'group',
  defaultLen: 0,
  properties: [{name: '', type: 'any'}]
};
const commonProperties: PropDesc[] = [
  {
    name: 'class',
    type: 'string',
    visible: 'high'
  },
  {
    name: 'style',
    type: 'object',
    visible: 'high',
    create: 'create-object'
  },
  {
    name: 'output',
    type: 'object',
    readonly: true
  }
];

const divElementDesc: FunctionDesc = {
  name: 'div',
  icon: 'fab:react',
  properties: [childrenPropertyGroup, ...commonProperties]
};

export class DivElementFunction extends BlockFunction {
  // _comp never changes, this prevent re-render of any parent component, TicloComp should handle all the changes internally
  readonly _comp: React.ReactNode;

  constructor(block: Block) {
    super(block);
    this._comp = <TicloComp key={block._blockId} block={block} />;
  }

  inputChanged(input: BlockIO, val: any): boolean {
    return true;
  }
  getComponent(): any {
    return 'div';
  }
  getProps(): {[key: string]: any} {
    return {className: this._data.getValue('class'), style: this._data.getValue('style')};
  }
  getChildren(): any[] {
    let result = [];
    let len = this._data.getLength();
    for (let i = 0; i < len; ++i) {
      result.push(this._data.getValue(`${i}`));
    }
    return result;
  }

  run(): any {
    this._data.output(React.createElement(this.getComponent(), this.getProps(), ...this.getChildren()), '#render');
    this._data.output(this._comp);
  }
}

Functions.add(DivElementFunction, divElementDesc, 'react');

class SpanElementFunction extends DivElementFunction {
  getComponent(): any {
    return 'span';
  }
}
Functions.add(SpanElementFunction, {...divElementDesc, name: 'span'}, 'react');

class PElementFunction extends DivElementFunction {
  getComponent(): any {
    return 'p';
  }
}
Functions.add(PElementFunction, {...divElementDesc, name: 'p'}, 'react');

class PreElementFunction extends DivElementFunction {
  getComponent(): any {
    return 'pre';
  }
}
Functions.add(PreElementFunction, {...divElementDesc, name: 'pre'}, 'react');

class ButtonElementFunction extends DivElementFunction {
  getComponent(): any {
    return 'button';
  }
}
Functions.add(ButtonElementFunction, {...divElementDesc, name: 'button'}, 'react');

class AElementFunction extends DivElementFunction {
  getComponent(): any {
    return 'a';
  }

  getProps(): {[p: string]: any} {
    return {...super.getProps(), href: this._data.getValue('href'), target: this._data.getValue('target')};
  }
}
Functions.add(
  AElementFunction,
  {
    name: 'a',
    icon: 'fab:react',
    properties: [
      childrenPropertyGroup,
      {
        name: 'href',
        type: 'string',
        visible: 'high'
      },
      {
        name: 'target',
        type: 'combo-box',
        options: ['_blank', '_self', '_parent', '_top'],
        visible: 'low'
      },
      ...commonProperties
    ]
  },
  'react'
);
