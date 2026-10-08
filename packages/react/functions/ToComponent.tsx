import React from 'react';
import {Block, globalFunctions, PureFunction} from '@ticlo/core';
import {TicloComp} from '../comp/Component.tsx';
import {elementAttributes} from '../comp/CommontProps.ts';

class ToReactComponentFunction extends PureFunction {
  run() {
    const block = this._data.getValue('input');
    if (block instanceof Block) {
      this._data.output(<TicloComp block={block} key={block._blockId} />, '#main');
      return;
    }
    if (typeof block === 'string' || typeof block === 'number') {
      this._data.output(block, '#main');
      return;
    }
    this._data.output(null, '#main');
  }
}

globalFunctions.addFactory(
  ToReactComponentFunction,
  {
    name: 'to-component',
    attributes: elementAttributes,
    tags: ['react-comp'],
    properties: [
      {name: 'input', type: 'block', pinned: true},
      {name: '#main', type: 'any', readonly: true, pinned: true},
    ],
  },
  'react'
);
