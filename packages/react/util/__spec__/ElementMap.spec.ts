import {Flow} from '@ticlo/core';
import {connectElementToBlock, findBlockFromParent} from '../ElementMap.js';

describe('ElementMap', function () {
  it('finds a block connected to an ancestor element', function () {
    const parent = document.createElement('div');
    const child = document.createElement('span');
    parent.appendChild(child);

    const block = new Flow().createBlock('mapped');
    connectElementToBlock(block, parent);

    expect(findBlockFromParent(child)).toBe(block);
  });
});
