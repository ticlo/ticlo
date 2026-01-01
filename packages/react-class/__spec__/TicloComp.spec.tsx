import React from 'react';
import {Flow} from '@ticlo/core';
import {TicloComp} from '../TicloComp.js';
import {creatReactRoot, ReactRoot} from '../../react/functions/__spec__/render.js';

describe('TicloComp', function () {
  let root: ReactRoot;
  beforeEach(function () {
    root = creatReactRoot();
  });
  afterEach(function () {
    root.remove();
  });
  it('basic render', async function () {
    const flow = new Flow();
    const aBlock = flow.createBlock('a');
    aBlock.setValue('#render', <span />);

    const comp = <TicloComp block={aBlock} />;
    await root.waitRender(comp);
    expect(root.div.children[0]).toBeInstanceOf(HTMLSpanElement);
  });
});
