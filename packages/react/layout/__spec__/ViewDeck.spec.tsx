import React, {useEffect} from 'react';
import {Block, BlockOrder, Flow, Root, globalFunctions} from '@ticlo/core';
import {WorkerFunctionGen} from '@ticlo/core/worker/WorkerFunctionGen.ts';
import {TicloComp, ViewDeck, metaKey, toSelectedIndex} from '../../index.ts';
import {creatReactRoot, type ReactRoot} from '../../functions/__spec__/render.ts';

describe('View Deck', () => {
  let root: ReactRoot;
  let flow: Flow;
  let rendered: Block[];
  let mounted: Set<Block>;
  let unmounted: Block[];
  const probeId = 'react-test:deck-child';

  beforeEach(() => {
    root = creatReactRoot();
    flow = new Flow();
    rendered = [];
    mounted = new Set();
    unmounted = [];
    function Probe({block}: {block: Block}) {
      rendered.push(block);
      useEffect(() => {
        mounted.add(block);
        return () => {
          mounted.delete(block);
          unmounted.push(block);
        };
      }, [block]);
      return <span>{block.getValue('label') as string}</span>;
    }
    globalFunctions.addFactory(null, {id: probeId, name: 'deck-child'}, undefined, undefined, {
      meta: {[metaKey]: Probe},
    });
  });

  afterEach(() => {
    root.remove();
    flow.destroy();
    globalFunctions.delete(probeId);
  });

  function createDeck() {
    flow.load({
      deck: {
        '#is': 'react:view-deck',
        '#order': ['first', 'second'],
        'first': {'#is': probeId, 'label': 'First'},
        'second': {'#is': probeId, 'label': 'Second'},
      },
    });
    return flow.getValue('deck') as Block;
  }

  it.each([
    [undefined, -1],
    [null, -1],
    ['', -1],
    [' ', -1],
    [false, -1],
    [NaN, -1],
    [Infinity, -1],
    ['invalid', -1],
    [-1, -1],
    [0, 0],
    ['1', 1],
    [1.9, 1],
    ['2.9', 2],
    ['1,2', -1],
  ])('normalizes single index %j to %s with an empty-selection default', (value, expected) => {
    expect(toSelectedIndex(value)).toBe(expected);
  });

  it('only creates the selected React child and unmounts it when switching, retaining both Blocks', async () => {
    const deck = createDeck();
    deck.setValue('class', 'custom');
    deck.setValue('style', {width: 200, height: 200});
    deck.setValue('#optional', ['id']);
    deck.setValue('id', 'deck');
    const first = deck.getValue('first') as Block;
    const second = deck.getValue('second') as Block;

    await root.waitRender(<TicloComp block={deck} />);
    expect(root.div.firstElementChild.className).toBe('ticl-view-deck custom');
    expect(root.div.firstElementChild.id).toBe('deck');
    expect((root.div.firstElementChild as HTMLElement).style.width).toBe('200px');
    expect(root.div.textContent).toBe('First');
    expect(rendered).toEqual([first]);
    expect([...mounted]).toEqual([first]);

    deck.updateValue('selectedIndex', 1);
    await root.waitRender();
    expect(root.div.textContent).toBe('Second');
    expect([...mounted]).toEqual([second]);
    expect(unmounted).toEqual([first]);
    expect(deck.getValue('first')).toBe(first);
    expect(deck.getValue('second')).toBe(second);
    expect(first._destroyed).toBeFalsy();
    expect(second._destroyed).toBeFalsy();

    deck.updateValue('selectedIndex', 0);
    await root.waitRender();
    expect([...mounted]).toEqual([first]);
    expect(unmounted).toEqual([first, second]);
  });

  it('uses the deck default for invalid indices and renders nothing for an index beyond its children', async () => {
    const deck = createDeck();
    await root.waitRender(<ViewDeck block={deck} />);
    for (const value of [null, '', false, NaN, Infinity, 'invalid', -1, -10]) {
      deck.updateValue('selectedIndex', value);
      await root.waitRender();
      expect(root.div.textContent).toBe('First');
    }
    for (const value of [1, 1.9, '1', '1.9']) {
      deck.updateValue('selectedIndex', value);
      await root.waitRender();
      expect(root.div.textContent).toBe('Second');
    }

    deck.updateValue('selectedIndex', 2);
    await root.waitRender();
    expect(root.div.firstElementChild.childNodes.length).toBe(0);
    expect(mounted.size).toBe(0);

    const third = deck.createBlock('third');
    third.setValue('#is', probeId);
    third.setValue('label', 'Third');
    deck.setValue('#order', ['first', 'second', 'third']);
    await root.waitRender();
    expect(root.div.textContent).toBe('Third');
  });

  it('responds to bindings and runtime selection without changing saved selection', async () => {
    const deck = createDeck();
    flow.setValue('index', 0);
    deck.setBinding('selectedIndex', '##.index');
    const saved = flow.save();
    await root.waitRender(<TicloComp block={deck} />);
    expect(root.div.textContent).toBe('First');

    flow.updateValue('index', '1.9');
    await root.waitRender();
    expect(root.div.textContent).toBe('Second');
    expect(flow.save()).toEqual(saved);
    expect(deck.getProperty('selectedIndex')._bindingPath).toBe('##.index');

    deck.updateValue('selectedIndex', 0);
    await root.waitRender();
    expect(root.div.textContent).toBe('First');
    expect(flow.save()).toEqual(saved);
  });

  it('indexes the same content and ordered Blocks as other containers', async () => {
    const deck = createDeck();
    deck.setValue('content', 'Content');
    deck.setValue('#order', ['missing', 'first', 'second']);
    await root.waitRender(<TicloComp block={deck} />);
    expect(root.div.textContent).toBe('Content');
    expect(rendered).toEqual([]);

    deck.updateValue('selectedIndex', 1);
    await root.waitRender();
    expect(root.div.textContent).toBe('First');
    deck.setValue('content', undefined);
    await root.waitRender();
    expect(root.div.textContent).toBe('Second');
    deck.setValue('#order', ['second', 'first']);
    await root.waitRender();
    expect(root.div.textContent).toBe('First');
  });

  it('renders and watches children forwarded through a worker, including unmounted worker dataflow', async () => {
    WorkerFunctionGen.registerType(
      {
        '#inputs': {
          '#is': '',
          '#custom': [
            {name: '#order', type: 'array'},
            {name: 'selectedIndex', type: 'number'},
          ],
        },
        '#main': {
          '#is': 'react:view-deck',
          '~#order': '##.#inputs.#order',
          '~selectedIndex': '##.#inputs.selectedIndex',
        },
        '#outputs': {'#is': '', '~#return': '##.#main'},
      },
      {id: ':deck', name: 'deck'},
      undefined,
      flow.getFuncLib()
    );
    flow.load({
      deck: {
        '#is': ':deck',
        '#order': ['first', 'second'],
        'selectedIndex': 0,
        'first': {'#is': 'react:span', 'content': 'First'},
        'second': {
          '#is': 'worker',
          '#use': {
            '#is': {
              '#is': '',
              'calculation': {'#is': 'add', '0': 2, '1': 3},
              '#main': {'#is': 'react:span', '~content': '##.calculation.#output'},
              '#outputs': {'#is': '', '~#return': '##.#main', '~#output': '##.calculation.#output'},
            },
          },
        },
      },
    });
    Root.run();
    const deck = flow.getValue('deck') as Block;
    const main = deck.getValue('#return') as Block;
    const second = deck.getValue('second') as Block;
    expect(main.getValue('#order')).toBeInstanceOf(BlockOrder);
    await root.waitRender(<TicloComp block={deck} />);
    expect(root.div.textContent).toBe('First');
    expect(second.getValue('#output')).toBe(5);

    (second.queryValue('#worker.calculation') as Block).setValue('0', 7);
    Root.run();
    expect(second.getValue('#output')).toBe(10);
    deck.updateValue('selectedIndex', 1);
    await root.waitRender();
    expect(root.div.textContent).toBe('10');

    deck.deleteValue('second');
    const replacement = deck.createBlock('second');
    replacement.setValue('#is', 'react:span');
    replacement.setValue('content', 'Replacement');
    await root.waitRender();
    expect(root.div.textContent).toBe('Replacement');
  });

  it.each(['div', 'horizontal', 'vertical', 'absolute'])(
    '%s still renders every child with a selectedIndex',
    async (name) => {
      const block = createDeck();
      block.setValue('#is', `react:${name}`);
      block.setValue('selectedIndex', 1);
      await root.waitRender(<TicloComp block={block} />);
      expect(root.div.textContent).toBe('FirstSecond');
      expect(mounted.size).toBe(2);
    }
  );
});
