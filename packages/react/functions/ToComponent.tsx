import React from 'react';
import {Block, Functions, PureFunction} from '@ticlo/core';
import {TicloComp} from '../comp/Component.js';

class ToReactComponentFunction extends PureFunction {
  run() {
    const block = this._data.getValue('input');
    if (block instanceof Block) {
      this._data.output(<TicloComp block={block} key={block._blockId} />);
      return;
    }
    if (typeof block === 'string' || typeof block === 'number') {
      this._data.output(block);
      return;
    }
    this._data.output(null);
  }
}

Functions.add(
  ToReactComponentFunction,
  {
    name: 'to-component',
    properties: [
      {name: 'input', type: 'block', pinned: true},
      {name: '#output', type: 'any', readonly: true, pinned: true},
    ],
  },
  'react'
);
