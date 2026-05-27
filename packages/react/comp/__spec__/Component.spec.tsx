import React from 'react';
import {Flow, globalFunctions} from '@ticlo/core';
import {TicloComp} from '../Component.js';
import {creatReactRoot, type ReactRoot} from '../../functions/__spec__/render.js';

globalFunctions.addFactory(
  null,
  {
    name: 'dynamic-output',
    properties: [{name: '#output', type: 'any', readonly: true, pinned: true}],
  },
  'react-test'
);

globalFunctions.addFactory(
  null,
  {
    name: 'fixed-output',
    properties: [{name: '#output', type: 'string', readonly: true, pinned: true}],
  },
  'react-test'
);

describe('TicloComp', function () {
  let root: ReactRoot;

  beforeEach(function () {
    root = creatReactRoot();
  });

  afterEach(function () {
    root.remove();
  });

  it('renders dynamic #output react elements', async function () {
    const flow = new Flow();
    const block = flow.createBlock('a');
    block.setValue('#is', 'react-test:dynamic-output');

    await root.waitRender(<TicloComp block={block} />);
    expect(root.div.children.length).toBe(0);

    block.updateValue('#output', <span>output</span>);
    await root.waitRender();
    expect(root.div.children[0]).toBeInstanceOf(HTMLSpanElement);
    expect(root.div.textContent).toBe('output');
  });

  it('renders dynamic #output blocks', async function () {
    const flow = new Flow();
    const block = flow.createBlock('a');
    const output = flow.createBlock('b');
    block.setValue('#is', 'react-test:dynamic-output');
    output.setValue('#is', 'react-test:dynamic-output');
    output.updateValue('#output', <span>nested output</span>);
    block.updateValue('#output', output);

    await root.waitRender(<TicloComp block={block} />);
    expect(root.div.children[0]).toBeInstanceOf(HTMLSpanElement);
    expect(root.div.textContent).toBe('nested output');
  });

  it('does not render non-dynamic outputs', async function () {
    const flow = new Flow();
    const block = flow.createBlock('a');
    block.setValue('#is', 'react-test:fixed-output');
    block.updateValue('#output', <span>hidden</span>);

    await root.waitRender(<TicloComp block={block} />);
    expect(root.div.children.length).toBe(0);
  });
});
