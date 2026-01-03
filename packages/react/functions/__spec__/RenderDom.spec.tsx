import React from 'react';
import {Flow, Root} from '@ticlo/core';
import type { ReactRoot} from './render.js';
import {creatReactRoot} from './render.js';
import '../RenderDom.js';

describe('TicloComp', function () {
  let root: ReactRoot;
  beforeEach(function () {
    root = creatReactRoot(false);
  });
  afterEach(function () {
    root.remove();
  });
  it('basic render', async function () {
    const flow = new Flow();
    const aBlock = flow.createBlock('a');
    aBlock.setValue('#is', 'react:render-dom');
    aBlock.setValue('component', <span />);
    aBlock.updateValue('container', root.div);
    Root.run();
    await root.waitRender();
    expect(root.div.children[0]).toBeInstanceOf(HTMLSpanElement);
  });
});
