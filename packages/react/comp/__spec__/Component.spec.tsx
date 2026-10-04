import React from 'react';
import {Event as TicloEvent, Flow, Root, globalFunctions, type Block} from '@ticlo/core';
import {Namespace} from '@ticlo/core/block/Namespace.ts';
import {WorkerFunctionGen} from '@ticlo/core/worker/WorkerFunctionGen.ts';
import {metaKey, TicloComp} from '../Component.tsx';
import {creatReactRoot, type ReactRoot} from '../../functions/__spec__/render.ts';
import '../../elements/CommonElements.tsx';
import '../../functions/ToComponent.tsx';

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
    name: 'dynamic-main',
    properties: [{name: '#main', type: 'any', readonly: true, pinned: true}],
  },
  'react-test'
);

globalFunctions.addFactory(
  null,
  {
    name: 'dynamic-output',
    properties: [{name: '#output', type: 'any', readonly: true, pinned: true}],
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

  it('renders dynamic #main react elements', async function () {
    const flow = new Flow();
    const block = flow.createBlock('a');
    block.setValue('#is', 'react-test:dynamic-main');

    await root.waitRender(<TicloComp block={block} />);
    expect(root.div.children.length).toBe(0);

    block.updateValue('#main', <span>output</span>);
    await root.waitRender();
    expect(root.div.children[0]).toBeInstanceOf(HTMLSpanElement);
    expect(root.div.textContent).toBe('output');
  });

  it('renders dynamic #main blocks', async function () {
    const flow = new Flow();
    const block = flow.createBlock('a');
    const output = flow.createBlock('b');
    block.setValue('#is', 'react-test:dynamic-main');
    output.setValue('#is', 'react-test:dynamic-main');
    output.updateValue('#main', <span>nested output</span>);
    block.updateValue('#main', output);

    await root.waitRender(<TicloComp block={block} />);
    expect(root.div.children[0]).toBeInstanceOf(HTMLSpanElement);
    expect(root.div.textContent).toBe('nested output');
  });

  it('does not use #output as a component entry', async function () {
    const flow = new Flow();
    const block = flow.createBlock('a');
    block.setValue('#is', 'react-test:dynamic-output');
    block.updateValue('#output', <span>hidden</span>);

    await root.waitRender(<TicloComp block={block} />);
    expect(root.div.children.length).toBe(0);
  });

  it('renders a flow through its #main component tree', async function () {
    const flow = new Flow();
    await root.waitRender(<TicloComp block={flow} />);
    expect(root.div.children.length).toBe(0);

    flow.load({
      '#is': '',
      '#main': {
        '#is': 'react:div',
        '#order': ['title'],
        'title': {'#is': 'react:span', 'content': 'Hello'},
      },
    });
    await root.waitRender();
    expect(root.div.firstElementChild).toBeInstanceOf(HTMLDivElement);
    expect(root.div.firstElementChild.firstElementChild).toBeInstanceOf(HTMLSpanElement);
    expect(root.div.textContent).toBe('Hello');

    flow.deleteValue('#main');
    await root.waitRender();
    expect(root.div.children.length).toBe(0);
    flow.destroy();
  });

  it('renders a worker #main block output alongside a data #output', async function () {
    const flow = new Flow();
    WorkerFunctionGen.registerType(
      {
        '#is': '',
        '#inputs': {'#is': '', '#custom': [{name: 'label', type: 'string'}]},
        '#main': {'#is': 'react:div', '~content': '##.#inputs.label'},
        '#outputs': {
          '#is': '',
          '#custom': [
            {name: '#main', type: 'block'},
            {name: '#output', type: 'number'},
          ],
          '~#main': '##.#main',
          '#output': 17,
        },
      },
      {id: ':component', name: 'component'},
      undefined,
      flow.getFuncLib()
    );
    const block = flow.createBlock('component');
    block.setValue('#is', ':component');
    block.setValue('label', 'Worker');
    Root.run();

    const worker = block.getValue('#worker') as Flow;
    expect(block.getValue('#main')).toBe(worker.getValue('#main'));
    expect(block.getValue('#output')).toBe(17);
    await root.waitRender(<TicloComp block={block} />);
    expect(root.div.textContent).toBe('Worker');

    block.setValue('label', 'Updated');
    Root.run();
    await root.waitRender();
    expect(root.div.textContent).toBe('Updated');

    await root.waitRender(<TicloComp block={worker} />);
    expect(root.div.textContent).toBe('Updated');
    flow.destroy();
  });

  it('renders the #main result of react:to-component', async function () {
    const flow = new Flow();
    const component = flow.createBlock('component');
    component.setValue('#is', 'react:span');
    component.setValue('content', 'Converted');
    const block = flow.createBlock('convert');
    block.setValue('#is', 'react:to-component');
    block.setValue('input', component);
    Root.run();

    expect(React.isValidElement(block.getValue('#main'))).toBe(true);
    expect(block.getValue('#output')).toBeUndefined();
    await root.waitRender(<TicloComp block={block} />);
    expect(root.div.textContent).toBe('Converted');
    flow.destroy();
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

  it('maps optional attributes, refs, and events to their React semantics', async function () {
    const flow = new Flow();
    const block = flow.createBlock('element');
    block.setValue('#is', 'react:div');
    block.setValue('#optional', ['id', 'ref', 'onClick']);
    block.setValue('id', 'optional-id');

    await root.waitRender(<TicloComp block={block} />);

    const element = root.div.firstElementChild as HTMLDivElement;
    expect(element.id).toBe('optional-id');
    expect(block.getValue('ref')).toBe(element);
    element.click();
    expect(block.getValue('onClick')).toBeInstanceOf(TicloEvent);
    flow.destroy();
  });

  it('remounts block-specific hooks when the rendered block changes', async function () {
    const flow = new Flow();
    const first = flow.createBlock('first');
    const second = flow.createBlock('second');
    for (const block of [first, second]) {
      block.setValue('#is', 'react:div');
      block.setValue('#optional', ['onClick']);
    }
    first.setValue('class', 'first-class');
    first.setValue('content', 'first-content');
    second.setValue('class', 'second-class');
    second.setValue('content', 'second-content');

    await root.waitRender(<TicloComp block={first} />);
    await root.waitRender(<TicloComp block={second} />);

    const element = root.div.firstElementChild as HTMLDivElement;
    expect(element.className).toBe('second-class');
    expect(element.textContent).toBe('second-content');
    element.click();
    expect(first.getValue('onClick')).toBeUndefined();
    expect(second.getValue('onClick')).toBeInstanceOf(TicloEvent);
    flow.destroy();
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
