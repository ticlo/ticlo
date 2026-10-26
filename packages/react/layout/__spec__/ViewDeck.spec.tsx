import React, {useEffect} from 'react';
import {Block, BlockOrder, Flow, Root, globalFunctions} from '@ticlo/core';
import {WorkerFunctionGen} from '@ticlo/core/worker/WorkerFunctionGen.ts';
import {shouldHappen} from '@ticlo/core/util/test-util.ts';
import {ComponentContext, TicloComp, ViewDeck, metaKey, toSelectedIndex} from '../../index.ts';
import {defaultComponentContext} from '../../ComponentContext.ts';
import {creatReactRoot, type ReactRoot} from '../../functions/__spec__/render.ts';
import '../../style/index.css';

describe('View Deck', () => {
  let root: ReactRoot;
  let flow: Flow;
  let rendered: Block[];
  let mounted: Set<Block>;
  let unmounted: Block[];
  let effectStyle: HTMLStyleElement;
  const probeId = 'react-test:deck-child';

  beforeEach(() => {
    root = creatReactRoot();
    document.body.append(root.div);
    flow = new Flow();
    rendered = [];
    mounted = new Set();
    unmounted = [];
    effectStyle = document.createElement('style');
    effectStyle.textContent = `
      @keyframes test-deck-show {
        from { transform: translateX(var(--ticl-view-deck-x)); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes test-deck-hide {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(var(--ticl-view-deck-x)); opacity: 0; }
      }
    `;
    document.head.append(effectStyle);
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
    effectStyle.remove();
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

  function animateDeck(animation = 'slide') {
    const deck = createDeck();
    deck.setValue('animation', animation);
    deck.setValue('style', {width: 200, height: 160});
    return deck;
  }

  function animations() {
    const running = root.div.firstElementChild.getAnimations({subtree: true});
    running.forEach((animation) => animation.pause());
    return running;
  }

  async function finishAnimations() {
    for (const animation of animations()) animation.finish();
    await root.waitRender();
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
    expect(root.div.textContent).toBe('First');
    expect(rendered).toEqual([deck.getValue('first')]);

    deck.updateValue('selectedIndex', 2);
    await root.waitRender();
    expect(root.div.textContent).toBe('Content');
    deck.setValue('content', undefined);
    await root.waitRender();
    expect(root.div.textContent).toBe('');
    deck.updateValue('selectedIndex', 1);
    await root.waitRender();
    expect(root.div.textContent).toBe('Second');
    deck.setValue('#order', ['second', 'first']);
    await root.waitRender();
    expect(root.div.textContent).toBe('First');
  });

  it.each(['div', 'horizontal', 'vertical', 'absolute', 'view-deck'])(
    '%s expands and updates content arrays between ordered children',
    async (name) => {
      const block = createDeck();
      block.setValue('#is', `react:${name}`);
      block.setValue('#order', ['first', 'content', 'second']);
      const a = flow.createBlock('repeated-a');
      const b = flow.createBlock('repeated-b');
      a._load({'#is': probeId, 'label': 'A'});
      b._load({'#is': probeId, 'label': 'B'});
      block.updateValue('content', [a, b]);
      block.setValue('selectedIndex', 2);
      await root.waitRender(<TicloComp block={block} />);
      expect(root.div.textContent).toBe(name === 'view-deck' ? 'B' : 'FirstABSecond');

      block.updateValue('content', [b, a]);
      await root.waitRender();
      expect(root.div.textContent).toBe(name === 'view-deck' ? 'A' : 'FirstBASecond');

      block.setValue('#order', ['first', 'second']);
      await root.waitRender();
      expect(root.div.textContent).toBe(name === 'view-deck' ? 'B' : 'FirstSecondBA');
    }
  );

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

  it('retains just the two transitioning React pages and preserves the incoming instance on completion', async () => {
    const deck = animateDeck();
    const first = deck.getValue('first') as Block;
    const second = deck.getValue('second') as Block;
    flow.setValue('index', 0);
    deck.setBinding('selectedIndex', '##.index');
    const saved = flow.save();
    await root.waitRender(<TicloComp block={deck} />);
    expect(animations()).toHaveLength(0);

    flow.updateValue('index', 1);
    await root.waitRender();
    animations().forEach((animation) => animation.pause());
    expect([...mounted]).toEqual([first, second]);
    expect(unmounted).toEqual([]);
    const outgoing = root.div.querySelector<HTMLDivElement>('.ticl-view-deck-outgoing');
    const incoming = outgoing.nextElementSibling;
    const child = incoming.firstElementChild;
    expect(outgoing.inert).toBe(true);
    expect((incoming as HTMLElement).inert).toBe(false);
    expect(deck.getValue('selectedIndex')).toBe(1);
    expect(flow.save()).toEqual(saved);

    await finishAnimations();
    expect([...mounted]).toEqual([second]);
    expect(unmounted).toEqual([first]);
    expect(root.div.querySelector('.ticl-view-deck-page')).toBe(incoming);
    expect(incoming.firstElementChild).toBe(child);
    expect(animations()).toHaveLength(0);
    expect(flow.save()).toEqual(saved);
  });

  for (const effect of ['slide', 'custom']) {
    it.each([
      [0, 1],
      [1, 0],
      [0, 2],
      [2, 0],
    ])(`${effect} positions pages by index when selecting %i → %i`, async (from, to) => {
      const deck = animateDeck(effect);
      const third = deck.createBlock('third');
      third.setValue('#is', probeId);
      third.setValue('label', 'Third');
      deck.setValue('#order', ['first', 'second', 'third']);
      deck.setValue('showEffect', 'test-deck-show');
      deck.setValue('hideEffect', 'test-deck-hide');
      deck.setValue('selectedIndex', from);
      await root.waitRender(<ViewDeck block={deck} />);
      deck.updateValue('selectedIndex', to);
      await root.waitRender();
      const running = animations();
      expect(running).toHaveLength(2);
      running.forEach((animation) => {
        animation.currentTime = 0;
      });
      const bounds = root.div.firstElementChild.getBoundingClientRect();
      const outgoing = root.div.querySelector('.ticl-view-deck-outgoing');
      const incoming = root.div.querySelector('.ticl-view-deck-page:not(.ticl-view-deck-outgoing)');
      expect(outgoing.getBoundingClientRect().x - bounds.x).toBeCloseTo(0);
      expect(incoming.getBoundingClientRect().x - bounds.x).toBeCloseTo(to > from ? 200 : -200);
      for (const animation of running) {
        animation.currentTime = Number((animation.effect as KeyframeEffect).getTiming().duration);
      }
      expect(outgoing.getBoundingClientRect().x - bounds.x).toBeCloseTo(to > from ? -200 : 200);
      expect(incoming.getBoundingClientRect().x - bounds.x).toBeCloseTo(0);
      expect(outgoing.getBoundingClientRect().y - bounds.y).toBeCloseTo(0);
      expect(incoming.getBoundingClientRect().y - bounds.y).toBeCloseTo(0);
      await finishAnimations();
    });
  }

  it.each(['fade', 'zoom'])('%s animates layers without changing child transforms or opacity', async (effect) => {
    const deck = animateDeck(effect);
    const first = deck.getValue('first') as Block;
    const second = deck.getValue('second') as Block;
    for (const child of [first, second]) {
      child.setValue('#is', 'react:div');
      child.setValue('style', {transform: 'rotate(15deg)', opacity: 0.6});
    }
    await root.waitRender(<ViewDeck block={deck} />);
    deck.updateValue('selectedIndex', 1);
    await root.waitRender();
    expect(animations()).toHaveLength(effect === 'fade' ? 1 : 2);
    for (const animation of animations()) {
      expect((animation.effect as KeyframeEffect).target.className).toContain('ticl-view-deck-page');
    }
    for (const child of root.div.querySelectorAll<HTMLElement>('.ticl-view-deck-page > div')) {
      expect(child.style.transform).toBe('rotate(15deg)');
      expect(child.style.opacity).toBe('0.6');
    }
    await finishAnimations();
  });

  it.each(['none', 'unknown', 'cover', 'reveal', 'custom'])(
    'switches immediately for animation %s without any applicable effects',
    async (effect) => {
      const deck = animateDeck(effect);
      await root.waitRender(<ViewDeck block={deck} />);
      deck.updateValue('selectedIndex', 1);
      await root.waitRender();
      expect(animations()).toHaveLength(0);
      expect(mounted.size).toBe(1);
    }
  );

  it.each([
    ['test-deck-show', '', 1, false],
    ['', 'test-deck-hide', 1, true],
    ['missing-show', 'test-deck-hide', 1, true],
    ['test-deck-show', 'missing-hide', 1, false],
    [' test-deck-show ', ' test-deck-hide ', 2, false],
  ])(
    'runs custom effects %s / %s with the moving page visible',
    async (showEffect, hideEffect, count, outgoingAbove) => {
      const deck = animateDeck('custom');
      deck.setValue('showEffect', showEffect);
      deck.setValue('hideEffect', hideEffect);
      await root.waitRender(<ViewDeck block={deck} />);
      deck.updateValue('selectedIndex', 1);
      await root.waitRender();
      const running = animations();
      expect(running).toHaveLength(count);
      expect(running.every((animation) => animation instanceof CSSAnimation)).toBe(true);
      const outgoing = root.div.querySelector<HTMLElement>('.ticl-view-deck-outgoing');
      const incoming = outgoing.nextElementSibling as HTMLElement;
      expect(Number(getComputedStyle(outgoing).zIndex) > Number(getComputedStyle(incoming).zIndex)).toBe(outgoingAbove);
      await finishAnimations();
      expect(root.div.querySelector('.ticl-view-deck-page')).toBe(incoming);
      expect(incoming.style.animation).toBe('');
      expect(incoming.style.getPropertyValue('--ticl-view-deck-x')).toBe('');
    }
  );

  it.each([
    ['missing-show', 'missing-hide'],
    [17, null],
    ['none', 'none'],
  ])('does not retain pages for missing or invalid custom effect names', async (showEffect, hideEffect) => {
    const deck = animateDeck('custom');
    deck.setValue('showEffect', showEffect);
    deck.setValue('hideEffect', hideEffect);
    await root.waitRender(<ViewDeck block={deck} />);
    deck.updateValue('selectedIndex', 1);
    await root.waitRender();
    expect(animations()).toHaveLength(0);
    expect(mounted.size).toBe(1);
    expect(root.div.textContent).toBe('Second');
  });

  it.each(['slide', 'custom'])(
    '%s settles rapid changes at the latest page and ignores cancelled completion callbacks',
    async (effect) => {
      const deck = animateDeck(effect);
      deck.setValue('showEffect', 'test-deck-show');
      deck.setValue('hideEffect', 'test-deck-hide');
      const first = deck.getValue('first') as Block;
      await root.waitRender(<ViewDeck block={deck} />);
      const original = root.div.querySelector('.ticl-view-deck-page');
      deck.updateValue('selectedIndex', 1);
      await root.waitRender();
      const previous = animations();
      deck.updateValue('selectedIndex', 0);
      await root.waitRender();
      expect([...mounted]).toEqual([first]);
      expect(root.div.querySelector('.ticl-view-deck-page')).toBe(original);
      expect(previous.every((animation) => animation.playState === 'idle')).toBe(true);
      expect(animations()).toHaveLength(0);
      deck.updateValue('selectedIndex', 1);
      await root.waitRender();
      expect(mounted.size).toBe(2);
      await finishAnimations();
    }
  );

  it('snapshots settings and does not remount pages when settings change', async () => {
    const deck = animateDeck();
    await root.waitRender(<ViewDeck block={deck} />);
    const original = root.div.querySelector('.ticl-view-deck-page');
    deck.setValue('animation', 'none');
    await root.waitRender();
    expect(root.div.querySelector('.ticl-view-deck-page')).toBe(original);
    expect(unmounted).toEqual([]);
    deck.setValue('animation', 'slide');
    deck.updateValue('selectedIndex', 1);
    await root.waitRender();
    const running = animations();
    deck.setValue('animation', 'none');
    deck.setValue('showEffect', 'test-deck-show');
    deck.setValue('hideEffect', 'test-deck-hide');
    await root.waitRender();
    expect(animations()).toEqual(running);
    await finishAnimations();
  });

  it('snapshots bound custom effect names without changing their saved values or bindings', async () => {
    const deck = animateDeck('custom');
    flow.setValue('show', 'test-deck-show');
    flow.setValue('hide', 'test-deck-hide');
    deck.setBinding('showEffect', '##.show');
    deck.setBinding('hideEffect', '##.hide');
    const saved = flow.save();
    await root.waitRender(<ViewDeck block={deck} />);
    deck.updateValue('selectedIndex', 1);
    await root.waitRender();
    const running = animations();
    expect(running).toHaveLength(2);
    flow.updateValue('show', 'missing-show');
    flow.updateValue('hide', 'missing-hide');
    await root.waitRender();
    expect(animations()).toEqual(running);
    await finishAnimations();
    deck.updateValue('selectedIndex', 0);
    await root.waitRender();
    expect(animations()).toHaveLength(0);
    expect(root.div.textContent).toBe('First');
    expect(flow.save()).toEqual(saved);
    expect(deck.getProperty('showEffect')._bindingPath).toBe('##.show');
    expect(deck.getProperty('hideEffect')._bindingPath).toBe('##.hide');
  });

  it('switches immediately for list changes, an empty selection, or the same resolved page', async () => {
    const deck = animateDeck();
    const first = deck.getValue('first') as Block;
    deck.setValue('content', [first]);
    await root.waitRender(<ViewDeck block={deck} />);
    const original = root.div.querySelector('.ticl-view-deck-page');
    deck.updateValue('selectedIndex', 2);
    await root.waitRender();
    expect(root.div.querySelector('.ticl-view-deck-page')).toBe(original);
    expect(animations()).toHaveLength(0);
    deck.updateValue('selectedIndex', 1);
    await root.waitRender();
    expect(animations()).toHaveLength(2);
    deck.setValue('#order', ['second', 'first']);
    await root.waitRender();
    expect(root.div.textContent).toBe('First');
    expect(animations()).toHaveLength(0);
    deck.updateValue('selectedIndex', 100);
    await root.waitRender();
    expect(root.div.firstElementChild.childNodes).toHaveLength(0);
    expect(mounted.size).toBe(0);
  });

  it('renders text and React content through transitions', async () => {
    const deck = animateDeck('custom');
    deck.setValue('showEffect', 'test-deck-show');
    deck.setValue('#order', ['content']);
    deck.setValue('content', ['Text', <button key="button">Button</button>]);
    await root.waitRender(<ViewDeck block={deck} />);
    deck.updateValue('selectedIndex', 1);
    await root.waitRender();
    expect(root.div.textContent).toBe('TextButton');
    const button = root.div.querySelector('button');
    await finishAnimations();
    expect(root.div.textContent).toBe('Button');
    expect(root.div.querySelector('button')).toBe(button);
  });

  it('cancels when entering design mode and switches without animation in design mode', async () => {
    const deck = animateDeck();
    const render = (designMode: boolean) => (
      <ComponentContext.Provider value={{...defaultComponentContext, designMode}}>
        <ViewDeck block={deck} />
      </ComponentContext.Provider>
    );
    await root.waitRender(render(false));
    deck.updateValue('selectedIndex', 1);
    await root.waitRender();
    expect(animations()).toHaveLength(2);
    await root.waitRender(render(true));
    expect(animations()).toHaveLength(0);
    expect(mounted.size).toBe(1);
    deck.updateValue('selectedIndex', 0);
    await root.waitRender();
    expect(animations()).toHaveLength(0);
    expect(root.div.textContent).toBe('First');
  });

  it('cancels when the viewport resizes or the deck unmounts', async () => {
    const deck = animateDeck();
    await root.waitRender(<ViewDeck block={deck} />);
    deck.updateValue('selectedIndex', 1);
    await root.waitRender();
    deck.setValue('style', {width: 240, height: 160});
    await root.waitRender();
    await shouldHappen(() => !root.div.querySelector('.ticl-view-deck-outgoing') && mounted.size === 1);
    expect(mounted.size).toBe(1);
    deck.updateValue('selectedIndex', 0);
    await root.waitRender();
    const running = animations();
    await root.waitRender(<></>);
    expect(running.every((animation) => animation.playState === 'idle')).toBe(true);
    expect(mounted.size).toBe(0);
  });

  it.each(['slide', 'custom'])('cleans up when a native %s animation is cancelled', async (effect) => {
    const deck = animateDeck(effect);
    deck.setValue('showEffect', 'test-deck-show');
    deck.setValue('hideEffect', 'test-deck-hide');
    await root.waitRender(<ViewDeck block={deck} />);
    deck.updateValue('selectedIndex', 1);
    await root.waitRender();
    animations()[0].cancel();
    await root.waitRender();
    expect(mounted.size).toBe(1);
    expect(animations()).toHaveLength(0);
    expect(root.div.textContent).toBe('Second');
  });

  it('switches immediately when the animation API is unavailable', async () => {
    const original = Element.prototype.animate;
    Element.prototype.animate = undefined;
    try {
      const deck = animateDeck();
      await root.waitRender(<ViewDeck block={deck} />);
      deck.updateValue('selectedIndex', 1);
      await root.waitRender();
      expect(mounted.size).toBe(1);
      expect(root.div.textContent).toBe('Second');
    } finally {
      Element.prototype.animate = original;
    }
  });

  it.each(['fixed', 'auto', 'percentage', 'explicit'])(
    'preserves %s sizing and excludes the outgoing page from intrinsic size',
    async (sizing) => {
      const deck = animateDeck();
      const first = deck.getValue('first') as Block;
      const second = deck.getValue('second') as Block;
      first.setValue('#is', 'react:div');
      second.setValue('#is', 'react:div');
      if (sizing === 'auto') {
        deck.setValue('style', undefined);
        first.setValue('style', {width: 300, height: 240});
        second.setValue('style', {width: 120, height: 80});
      } else if (sizing === 'percentage') {
        second.setValue('style', {width: '100%', height: '100%'});
      } else if (sizing === 'explicit') {
        second.setValue('style', {width: 120, height: 80});
      }
      await root.waitRender(<ViewDeck block={deck} />);
      const oldBounds = root.div.querySelector('.ticl-view-deck-page').getBoundingClientRect();
      deck.updateValue('selectedIndex', 1);
      await root.waitRender();
      animations().forEach((animation) => {
        animation.pause();
        animation.currentTime = 0;
      });
      const outgoing = root.div.querySelector('.ticl-view-deck-outgoing');
      const incoming = root.div.querySelector('.ticl-view-deck-page:not(.ticl-view-deck-outgoing)');
      expect(outgoing.getBoundingClientRect().width).toBeCloseTo(oldBounds.width);
      expect(outgoing.getBoundingClientRect().height).toBeCloseTo(oldBounds.height);
      const deckBounds = root.div.firstElementChild.getBoundingClientRect();
      expect(deckBounds.width).toBe(sizing === 'auto' ? 120 : 200);
      expect(deckBounds.height).toBe(sizing === 'auto' ? 80 : 160);
      expect(incoming.firstElementChild.getBoundingClientRect().width).toBe(
        sizing === 'auto' || sizing === 'explicit' ? 120 : 200
      );
      expect(incoming.firstElementChild.getBoundingClientRect().height).toBe(
        sizing === 'auto' || sizing === 'explicit' ? 80 : 160
      );
      await finishAnimations();
    }
  );
});
