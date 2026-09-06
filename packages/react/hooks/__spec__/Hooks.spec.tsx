import React from 'react';
import {vi} from 'vitest';
import {Flow, Root} from '@ticlo/core';
import type {Block} from '@ticlo/core';
import {creatReactRoot, type ReactRoot} from '../../functions/__spec__/render.js';
import {FlowRoot, useFlow} from '../useFlow.js';
import {useFilteredBlocks} from '../useFilteredBlocks.js';
import {useMemoUpdate, useRefState} from '../../util/react-tools.js';

function FlowName({capture}: {capture: {current?: Flow}}) {
  const flow = useFlow();
  capture.current = flow;
  return <span>{flow.getName()}</span>;
}

function FilteredBlockNames({block}: {block: Block}) {
  return <span>{Object.keys(useFilteredBlocks(block)).join(',')}</span>;
}

function MemoProbe({dependencies, init}: {dependencies: unknown[]; init: () => string}) {
  const [state] = useRefState(init);
  const [memo] = useMemoUpdate(() => state, dependencies);
  return <span>{memo}</span>;
}

describe('react hooks', function () {
  let root: ReactRoot;

  beforeEach(function () {
    root = creatReactRoot();
  });

  afterEach(function () {
    root.remove();
  });

  it('uses a provided Flow as the context value', async function () {
    const flow = new Flow();
    const capture: {current?: Flow} = {};

    await root.waitRender(
      <FlowRoot flow={flow}>
        <FlowName capture={capture} />
      </FlowRoot>
    );

    expect(capture.current).toBe(flow);
  });

  it('releases its named temporary Flow when switching to a provided Flow', async function () {
    const capture: {current?: Flow} = {};

    await root.waitRender(
      <FlowRoot flow={{value: 1}}>
        <FlowName capture={capture} />
      </FlowRoot>
    );

    const name = capture.current.getName();
    expect(name).toMatch(/^temp-flow-/);
    expect(Root.instance.getValue(name)).toBe(capture.current);

    const providedFlow = new Flow();
    await root.waitRender(
      <FlowRoot flow={providedFlow}>
        <FlowName capture={capture} />
      </FlowRoot>
    );
    await Promise.resolve();
    expect(capture.current).toBe(providedFlow);
    expect(Root.instance.getValue(name)).toBeUndefined();

    await root.waitRender(<></>);
    await Promise.resolve();
    expect(providedFlow.isDestroyed()).toBe(false);
    providedFlow.destroy();
  });

  it('keeps its temporary Flow during StrictMode effect replay', async function () {
    const capture: {current?: Flow} = {};

    await root.waitRender(
      <React.StrictMode>
        <FlowRoot flow={{value: 1}}>
          <FlowName capture={capture} />
        </FlowRoot>
      </React.StrictMode>
    );

    const flow = capture.current;
    const name = flow.getName();
    await Promise.resolve();
    expect(Root.instance.getValue(name)).toBe(flow);

    await root.waitRender(<></>);
    await Promise.resolve();
    expect(Root.instance.getValue(name)).toBeUndefined();
  });

  it('rebuilds filtered children when the source block changes', async function () {
    const flow = new Flow();
    const firstParent = flow.createBlock('first-parent');
    const secondParent = flow.createBlock('second-parent');
    firstParent.createBlock('first');
    secondParent.createBlock('second');

    await root.waitRender(<FilteredBlockNames block={firstParent} />);
    expect(root.div.textContent).toBe('first');

    await root.waitRender(<FilteredBlockNames block={secondParent} />);
    expect(root.div.textContent).toBe('second');
  });

  it('does not mutate memo dependencies or rerun state initializers', async function () {
    const dependencies: unknown[] = [];
    const init = vi.fn(() => 'value');

    await root.waitRender(<MemoProbe dependencies={dependencies} init={init} />);
    await root.waitRender(<MemoProbe dependencies={dependencies} init={init} />);

    expect(dependencies).toEqual([]);
    expect(init).toHaveBeenCalledTimes(1);
  });
});
