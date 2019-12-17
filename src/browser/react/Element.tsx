import React from 'react';
import {Types} from '../../core/block/Type';
import {BlockFunction} from '../../core/block/BlockFunction';
import {Block} from '../../core/block/Block';
import {TicloComp} from './TicloComp';
import {FunctionDesc, PropDesc, PropGroupDesc} from '../../core/block/Descriptor';
import {BlockIO} from '../../core/block/BlockProperty';

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
    visible: 'high'
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

Types.add(DivElementFunction, divElementDesc, 'react');

class SpanElementFunction extends DivElementFunction {
  getComponent(): any {
    return 'span';
  }
}
Types.add(SpanElementFunction, {...divElementDesc, name: 'span'}, 'react');

class PElementFunction extends DivElementFunction {
  getComponent(): any {
    return 'p';
  }
}
Types.add(PElementFunction, {...divElementDesc, name: 'p'}, 'react');

class PreElementFunction extends DivElementFunction {
  getComponent(): any {
    return 'pre';
  }
}
Types.add(PreElementFunction, {...divElementDesc, name: 'pre'}, 'react');

class ButtonElementFunction extends DivElementFunction {
  getComponent(): any {
    return 'button';
  }
}
Types.add(ButtonElementFunction, {...divElementDesc, name: 'button'}, 'react');

class AElementFunction extends DivElementFunction {
  getComponent(): any {
    return 'a';
  }

  getProps(): {[p: string]: any} {
    return {...super.getProps(), href: this._data.getValue('href'), target: this._data.getValue('target')};
  }
}
Types.add(
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
