import React from 'react';
import {Flow} from '@ticlo/core';
import {TicloComp} from '../../comp/Component.js';
import {creatReactRoot, type ReactRoot} from '../../functions/__spec__/render.js';
import '../../index.js';

describe('react img element', function () {
  let root: ReactRoot;

  beforeEach(function () {
    root = creatReactRoot();
  });

  afterEach(function () {
    root.remove();
  });

  it('renders as a void element without children', async function () {
    const flow = new Flow();
    const block = flow.createBlock('image');
    block.setValue('#is', 'react:img');
    block.setValue('src', 'image.png');

    await root.waitRender(<TicloComp block={block} />);

    const image = root.div.firstElementChild as HTMLImageElement;
    expect(image).toBeInstanceOf(HTMLImageElement);
    expect(image.getAttribute('src')).toBe('image.png');
  });
});
