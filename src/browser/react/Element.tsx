import React from 'react';
import {Types} from '../../core/block/Type';
import {BlockFunction} from '../../core/block/BlockFunction';
import {Block} from '../../core/block/Block';
import {TicloComp} from './TicloComp';

export class ElementFunction extends BlockFunction {
  // _comp never changes, this prevent re-render of any parent component, TicloComp should handle all the changes internally
  readonly _comp: React.ReactNode;
  constructor(block: Block) {
    super(block);
    this._comp = <TicloComp key={`${block._prop._name}#${block._blockId}`} block={block} />;
  }
  run(): any {
    return this._comp;
  }
}

Types.add(
  ElementFunction,
  {
    name: 'element',
    icon: 'fab:react',
    properties: [
      {
        name: 'tag',
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
