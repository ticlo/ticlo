import React from 'react';
import {Block, Functions, PureFunction} from '@ticlo/core';
import {TicloFuncComp} from '../types/Component.js';

class ToReactComponentFunction extends PureFunction {
  run() {
    const block = this._data.getValue('input');
    if (block instanceof Block) {
      this._data.output(<TicloFuncComp block={block} key={block._blockId} />);
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
      {name: 'input', type: 'any', pinned: true},
      {name: '#output', type: 'any', readonly: true, pinned: true},
    ],
  },
  'react'
);
