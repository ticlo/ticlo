import React from 'react';
import {Flow} from '@ticlo/core';
import {TicloComp} from '../TicloComp';
import {creatReactRoot, ReactRoot} from './render';

describe('TicloComp', function () {
  let root: ReactRoot;
  beforeEach(function () {
    root = creatReactRoot();
  });
  afterEach(function () {
    root.remove();
  });
  it('basic render', async function () {
    let flow = new Flow();
    let aBlock = flow.createBlock('a');
    aBlock.setValue('#render', <span />);

    let comp = <TicloComp block={aBlock} />;
    await root.waitRender(comp);
    expect(root.div.children[0]).toBeInstanceOf(HTMLSpanElement);
  });
});
