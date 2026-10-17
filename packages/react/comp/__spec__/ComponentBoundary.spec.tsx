import React, {StrictMode, useContext} from 'react';
import {vi} from 'vitest';
import {Block, Flow, Root, globalFunctions, type DataMap} from '@ticlo/core';
import {ComponentContext, type ComponentContextValue} from '../../ComponentContext.ts';
import {useTicloComp} from '../../hooks/useTicloComp.ts';
import {ElementMap} from '../../util/ElementMap.ts';
import {metaKey, renderChildren, TicloComp} from '../Component.tsx';
import {TicloPage} from '../TicloPage.tsx';
import {creatReactRoot, type ReactRoot} from '../../functions/__spec__/render.ts';

function worker(main: DataMap): DataMap {
  return {
    '#is': 'worker',
    '#use': {
      '#is': {
        '#is': '',
        '#main': main,
        '#outputs': {
          '#is': '',
          '#custom': [{name: '#main', type: 'block'}],
          '~#main': '##.#main',
        },
      },
    },
  };
}

describe('component context boundaries', () => {
  const functionId = 'react-test:boundary-probe';
  let root: ReactRoot;
  let flow: Flow;
  let contexts: Map<Block, ComponentContextValue<Block | string>>;

  beforeEach(() => {
    root = creatReactRoot();
    flow = new Flow();
    contexts = new Map();
    function Probe({block}: {block: Block}) {
      contexts.set(block, useContext(ComponentContext));
      const {optionalHandlers, children} = useTicloComp(block);
      const page = <div {...optionalHandlers}>{renderChildren(children)}</div>;
      return block.getValue('multipleRoots') ? (
        <>
          {page}
          <span {...optionalHandlers} />
        </>
      ) : (
        page
      );
    }
    globalFunctions.addFactory(null, {name: 'boundary-probe'}, 'react-test', undefined, {
      meta: {[metaKey]: Probe},
    });
  });

  afterEach(() => {
    root.remove();
    flow.destroy();
    globalFunctions.delete(functionId);
  });

  function createWorker(depth: number) {
    let data: DataMap = {
      '#is': functionId,
      '#order': ['child'],
      'child': {'#is': functionId, 'content': 'Internal child'},
    };
    for (let i = 0; i < depth; ++i) data = worker(data);
    flow.load({'#is': '', 'host': data});
    Root.run();
    const host = flow.getValue('host') as Block;
    let main = host;
    for (let i = 0; i < depth; ++i) main = main.getValue('#main') as Block;
    return {host, main};
  }

  it('renders a flow with a supplied context and fallback without a DOM wrapper', async () => {
    const elementMap = new ElementMap();
    const select = vi.fn(() => true);
    await root.waitRender(
      <TicloPage
        block={flow}
        context={{designMode: true, elementMap, select, addSelection: () => false}}
        fallback={<span>No main</span>}
      />
    );
    expect(root.div.innerHTML).toBe('<span>No main</span>');

    flow.load({'#is': '', '#main': {'#is': functionId, 'content': 'Flow root'}});
    Root.run();
    await root.waitRender();
    const main = flow.getValue('#main') as Block;
    expect(root.div.children.length).toBe(1);
    expect(root.div.firstElementChild.textContent).toBe('Flow root');
    expect(contexts.get(main).designMode).toBe(true);
    expect(contexts.get(main).select).toBe(select);
    expect(contexts.get(main).elementMap).toBe(elementMap);
    expect(elementMap.getBlock(root.div.firstElementChild)).toBe(main);
  });

  it.each([1, 3])('maps the root through %s worker boundaries without exposing descendants', async (depth) => {
    const {host, main} = createWorker(depth);
    const child = main.getValue('child') as Block;
    const elementMap = new ElementMap();
    const select = vi.fn(() => true);
    const addSelection = vi.fn(() => true);
    const context = {designMode: true, elementMap, select, addSelection};
    const render = (designMode: boolean) =>
      root.waitRender(
        <StrictMode>
          <ComponentContext.Provider value={{...context, designMode}}>
            <TicloComp block={host} />
          </ComponentContext.Provider>
        </StrictMode>
      );

    await render(true);
    const element = root.div.firstElementChild;
    const childElement = element.firstElementChild;
    const internal = contexts.get(main);
    expect(internal.designMode).toBe(false);
    expect(contexts.get(child)).toBe(internal);
    expect(internal.select([main])).toBe(false);
    expect(internal.addSelection([child])).toBe(false);
    expect(select).not.toHaveBeenCalled();
    expect(addSelection).not.toHaveBeenCalled();
    expect(internal.elementMap).not.toBe(elementMap);
    expect(internal.elementMap.getBlock(element)).toBe(main);
    expect(internal.elementMap.getBlock(childElement)).toBe(child);
    expect(elementMap.getBlock(element)).toBe(host);
    expect(elementMap.getElements(host)).toEqual([element]);
    expect(elementMap.getBlock(childElement)).toBeUndefined();
    expect(elementMap.getElements(main)).toBeUndefined();
    expect(elementMap.getElements(child)).toBeUndefined();

    await render(false);
    expect(root.div.firstElementChild).toBe(element);
    expect(contexts.get(main)).toBe(internal);
    expect(elementMap.getBlock(element)).toBe(host);
    expect(elementMap.getElements(host)).toEqual([element]);
  });

  it('tracks root elements that disappear and return without replacing the #main Block', async () => {
    const {host, main} = createWorker(3);
    const elementMap = new ElementMap();
    await root.waitRender(
      <ComponentContext.Provider value={{designMode: true, elementMap, select: () => false, addSelection: () => false}}>
        <TicloComp block={host} />
      </ComponentContext.Provider>
    );
    const element = root.div.firstElementChild;

    main.setValue('#is', '');
    Root.run();
    await root.waitRender();
    expect(root.div.children.length).toBe(0);
    expect(elementMap.getBlock(element)).toBeUndefined();
    expect(elementMap.getElements(host)).toEqual([]);

    main.setValue('#is', functionId);
    Root.run();
    await root.waitRender();
    const nextElement = root.div.firstElementChild;
    expect(nextElement).not.toBe(element);
    expect(elementMap.getBlock(nextElement)).toBe(host);
    expect(contexts.get(main).elementMap.getBlock(nextElement)).toBe(main);
    expect(elementMap.getElements(host)).toEqual([nextElement]);
  });

  it('propagates and cleans up multiple root elements through nested pages', async () => {
    const {host, main} = createWorker(3);
    main.setValue('multipleRoots', true);
    const elementMap = new ElementMap();
    await root.waitRender(
      <ComponentContext.Provider value={{designMode: true, elementMap, select: () => false, addSelection: () => false}}>
        <TicloComp block={host} />
      </ComponentContext.Provider>
    );
    const elements = Array.from(root.div.children);
    expect(elements.length).toBe(2);
    expect(elementMap.getElements(host)).toEqual(elements);
    for (const element of elements) {
      expect(elementMap.getBlock(element)).toBe(host);
      expect(contexts.get(main).elementMap.getBlock(element)).toBe(main);
    }

    await root.waitRender(<></>);
    expect(elementMap.getElements(host)).toEqual([]);
    for (const element of elements) expect(elementMap.getBlock(element)).toBeUndefined();
  });

  it('cleans up every context when a nested #main is cleared, replaced, or unmounted', async () => {
    const {host, main} = createWorker(3);
    const elementMap = new ElementMap();
    await root.waitRender(
      <ComponentContext.Provider value={{designMode: true, elementMap, select: () => false, addSelection: () => false}}>
        <TicloComp block={host} />
      </ComponentContext.Provider>
    );
    const element = root.div.firstElementChild;
    const internalMap = contexts.get(main).elementMap;

    main._flow.updateValue('#main', null);
    Root.run();
    await root.waitRender();
    expect(root.div.children.length).toBe(0);
    expect(elementMap.getBlock(element)).toBeUndefined();
    expect(elementMap.getElements(host)).toEqual([]);
    expect(internalMap.getBlock(element)).toBeUndefined();
    expect(internalMap.getElements(main)).toEqual([]);

    const replacement = main._flow.createBlock('replacement');
    replacement.setValue('#is', functionId);
    replacement.setValue('content', 'Replacement');
    main._flow.updateValue('#main', replacement);
    Root.run();
    await root.waitRender();
    const nextElement = root.div.firstElementChild;
    expect(nextElement.textContent).toBe('Replacement');
    expect(contexts.get(replacement).elementMap).toBe(internalMap);
    expect(internalMap.getBlock(nextElement)).toBe(replacement);
    expect(elementMap.getBlock(nextElement)).toBe(host);
    expect(elementMap.getElements(host)).toEqual([nextElement]);

    await root.waitRender(<></>);
    expect(internalMap.getBlock(nextElement)).toBeUndefined();
    expect(internalMap.getElements(replacement)).toEqual([]);
    expect(elementMap.getBlock(nextElement)).toBeUndefined();
    expect(elementMap.getElements(host)).toEqual([]);
  });
});
