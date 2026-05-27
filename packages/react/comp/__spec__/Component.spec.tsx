import React from 'react';
import {Block, Flow, globalFunctions} from '@ticlo/core';
import {Namespace} from '@ticlo/core/block/Namespace.js';
import {metaKey, TicloComp} from '../Component.js';
import {creatReactRoot, type ReactRoot} from '../../functions/__spec__/render.js';

function MetaComponent({block}: {block: Block}) {
  return <span>{block.getValue('label') as string}</span>;
}

function AltMetaComponent({block}: {block: Block}) {
  return <strong>{block.getValue('label') as string}</strong>;
}

globalFunctions.addFactory(
  null,
  {
    name: 'meta-component',
    properties: [{name: 'label', type: 'string'}],
  },
  'react-test',
  undefined,
  {meta: {[metaKey]: MetaComponent}}
);

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

  it('renders components registered in global function metadata', async function () {
    const flow = new Flow();
    const block = flow.createBlock('a');
    block.setValue('#is', 'react-test:meta-component');
    block.setValue('label', 'global');

    await root.waitRender(<TicloComp block={block} />);
    expect(root.div.children[0]).toBeInstanceOf(HTMLSpanElement);
    expect(root.div.textContent).toBe('global');
  });

  it('renders components registered in flow function metadata', async function () {
    const flow = new Flow();
    flow.getFuncLib().addFactory(
      null,
      {
        id: ':local-meta-component',
        name: 'local-meta-component',
        properties: [{name: 'label', type: 'string'}],
      },
      undefined,
      undefined,
      {meta: {[metaKey]: MetaComponent}}
    );
    const block = flow.createBlock('a');
    block.setValue('#is', ':local-meta-component');
    block.setValue('label', 'flow');

    await root.waitRender(<TicloComp block={block} />);
    expect(root.div.children[0]).toBeInstanceOf(HTMLSpanElement);
    expect(root.div.textContent).toBe('flow');
  });

  it('renders components registered in namespace function metadata', async function () {
    const lib = Namespace.getFunctionLib('+NsReactMeta:g');
    lib.addFactory(
      null,
      {
        id: 'ns-meta-component',
        name: 'ns-meta-component',
        properties: [{name: 'label', type: 'string'}],
      },
      undefined,
      undefined,
      {meta: {[metaKey]: MetaComponent}}
    );

    const flow = new Flow();
    const block = flow.createBlock('a');
    block.setValue('#is', '+NsReactMeta:g:ns-meta-component');
    block.setValue('label', 'namespace');

    await root.waitRender(<TicloComp block={block} />);
    expect(root.div.children[0]).toBeInstanceOf(HTMLSpanElement);
    expect(root.div.textContent).toBe('namespace');
  });

  it('updates when function factory component metadata changes', async function () {
    const flow = new Flow();
    const block = flow.createBlock('a');
    block.setValue('#is', 'react-test:live-meta-component');
    block.setValue('label', 'live');

    await root.waitRender(<TicloComp block={block} />);
    expect(root.div.children.length).toBe(0);

    globalFunctions.addFactory(
      null,
      {
        name: 'live-meta-component',
        properties: [{name: 'label', type: 'string'}],
      },
      'react-test',
      undefined,
      {meta: {[metaKey]: MetaComponent}}
    );
    await root.waitRender();
    expect(root.div.children[0]).toBeInstanceOf(HTMLSpanElement);
    expect(root.div.textContent).toBe('live');

    globalFunctions.addFactory(
      null,
      {
        name: 'live-meta-component',
        properties: [{name: 'label', type: 'string'}],
      },
      'react-test',
      undefined,
      {meta: {[metaKey]: AltMetaComponent}}
    );
    await root.waitRender();
    expect(root.div.children[0]).toBeInstanceOf(HTMLElement);
    expect(root.div.children[0].tagName).toBe('STRONG');
    expect(root.div.textContent).toBe('live');
  });
});
