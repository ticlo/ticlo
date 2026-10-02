import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {simulate} from 'simulate-event';
import React, {useState} from 'react';
import {NodeTree} from '../../index.ts';
import {Block, Root, globalFunctions} from '@ticlo/core';
import {destroyLastLocalConnection, makeLocalConnection} from '@ticlo/core/connect/LocalConnection.ts';
import {shouldHappen} from '@ticlo/core/util/test-util.ts';
import {removeLastTemplate, loadTemplate, querySingle} from '../../util/test-util.ts';

const parentId = 'test-tree-parent';
const childId = 'test-tree-child';
const wrongId = 'test-tree-wrong';
const flowPath = 'NodeTreeMove';

describe('node tree ordered drag/drop', () => {
  let client: ReturnType<typeof makeLocalConnection>[1];
  let server: ReturnType<typeof makeLocalConnection>[0];
  let tree: NodeTree;
  let div: HTMLElement;
  let selected: string[];

  beforeEach(() => {
    globalFunctions.addFactory(null, {
      id: parentId,
      name: parentId,
      tags: ['component'],
      childrenTags: ['component'],
      properties: [],
    });
    globalFunctions.addFactory(null, {id: childId, name: childId, tags: ['component'], properties: []});
    globalFunctions.addFactory(null, {id: wrongId, name: wrongId, tags: ['other'], properties: []});
    Root.instance.addFlow(flowPath, {
      source: {
        '#is': parentId,
        '#order': ['b', 'a', 'c', 'wrong'],
        'a': {'#is': childId},
        'b': {'#is': childId},
        'c': {'#is': childId},
        'extra': {'#is': childId},
        'wrong': {'#is': wrongId},
      },
      target: {'#is': parentId, '#order': ['x', 'y'], 'x': {'#is': childId}, 'y': {'#is': childId}},
    });
    [server, client] = makeLocalConnection(Root.instance);
  });

  afterEach(async () => {
    removeLastTemplate();
    await new Promise((resolve) => setTimeout(resolve, 100));
    destroyLastLocalConnection();
    Root.instance.deleteValue(flowPath);
    for (const id of [parentId, childId, wrongId]) globalFunctions.delete(id);
  });

  function row(name: string) {
    return querySingle(`//div.ticl-tree-node-text[text()='${name}']/..`, div) as HTMLElement;
  }

  async function open(name: string, child: string) {
    simulate(row(name).parentElement.querySelector('.ticl-tree-arr'), 'click');
    await shouldHappen(() => row(child)?.classList.contains('drag-initiator'));
  }

  async function render(keys: string[], basePath = flowPath, hideRoot = false) {
    function ControlledTree() {
      const [selectedKeys, setSelectedKeys] = useState(keys);
      selected = selectedKeys;
      return (
        <NodeTree
          ref={(value) => {
            tree = value;
          }}
          conn={client}
          basePaths={[basePath]}
          hideRoot={hideRoot}
          selectedKeys={selectedKeys}
          onSelect={setSelectedKeys}
          style={{width: 600, height: 600}}
        />
      );
    }
    [, div] = loadTemplate(<ControlledTree />, 'editor');
    if (!hideRoot) {
      await shouldHappen(() => row(flowPath)?.classList.contains('drag-initiator'));
      await open(flowPath, 'source');
      await open('source', 'a');
      await open('target', 'x');
    } else {
      await shouldHappen(() => row('a')?.classList.contains('drag-initiator'));
    }
    await shouldHappen(() => tree.list.find((item) => item.name === 'a')?.desc.id === childId);
    await shouldHappen(() => tree.rootList[0].desc.id);
  }

  async function drag(from: string, to: string, offset = 0.5) {
    const source = row(from);
    const target = row(to);
    const a = source.getBoundingClientRect();
    const b = target.getBoundingClientRect();
    const down = {button: 0, buttons: 1, clientX: a.left + a.width / 2, clientY: a.top + a.height / 2};
    const move = {button: 0, buttons: 1, clientX: b.left + b.width / 2, clientY: b.top + b.height * offset};
    simulate(source, 'mousedown', down);
    simulate(document, 'mousemove', {...down, clientX: down.clientX + 3});
    simulate(target, 'mousemove', move);
    await shouldHappen(
      () => target.className.includes('ticl-tree-drop-') || target.parentElement.className.includes('ticl-tree-drop-')
    );
    simulate(target, 'mouseup', {...move, buttons: 0});
  }

  it('moves all selected siblings into a parent in their source order', async () => {
    await render([`${flowPath}.source.a`, `${flowPath}.source.b`]);
    await drag('a', 'target');
    await shouldHappen(() => Root.instance.queryValue(`${flowPath}.target.a`) instanceof Block);
    expect(Root.instance.queryValue(`${flowPath}.source.#order`)).toEqual(['c', 'wrong']);
    expect(Root.instance.queryValue(`${flowPath}.target.#order`)).toEqual(['x', 'y', 'b', 'a']);
    await shouldHappen(() => selected.join(',') === `${flowPath}.target.b,${flowPath}.target.a`);
    await shouldHappen(() => !tree.list.some((item) => item.key === `${flowPath}.source.a`));
  });

  it.each([
    {keys: []},
    {keys: [`${flowPath}.source.a`, `${flowPath}.source.b`]},
    {keys: [`${flowPath}.source.a`, `${flowPath}.target.x`]},
  ])('moves only the unselected dragged node with selection $keys', async ({keys}) => {
    await render(keys);
    const a = Root.instance.queryValue(`${flowPath}.source.a`);
    const b = Root.instance.queryValue(`${flowPath}.source.b`);
    const x = Root.instance.queryValue(`${flowPath}.target.x`);
    await drag('c', 'target');
    await shouldHappen(() => Root.instance.queryValue(`${flowPath}.target.c`) instanceof Block);
    expect(Root.instance.queryValue(`${flowPath}.source.#order`)).toEqual(['b', 'a', 'wrong']);
    expect(Root.instance.queryValue(`${flowPath}.target.#order`)).toEqual(['x', 'y', 'c']);
    expect(Root.instance.queryValue(`${flowPath}.source.a`)).toBe(a);
    expect(Root.instance.queryValue(`${flowPath}.source.b`)).toBe(b);
    expect(Root.instance.queryValue(`${flowPath}.target.x`)).toBe(x);
    await shouldHappen(() => selected.join(',') === `${flowPath}.target.c`);
  });

  it('inserts before or after rows and supports reordering in one parent', async () => {
    await render([`${flowPath}.source.a`]);
    const original = Root.instance.queryValue(`${flowPath}.source.a`);
    await drag('a', 'b', 0.1);
    await shouldHappen(() => (Root.instance.queryValue(`${flowPath}.source.#order`) as string[])[0] === 'a');
    expect(Root.instance.queryValue(`${flowPath}.source.a`)).toBe(original);
    await shouldHappen(() => row('a')?.getBoundingClientRect().top < row('b')?.getBoundingClientRect().top);
    await shouldHappen(() => tree.list.find((item) => item.name === 'source')?.opened === 'opened');
    await drag('a', 'x', 0.9);
    await shouldHappen(() => Root.instance.queryValue(`${flowPath}.target.a`) instanceof Block);
    expect(Root.instance.queryValue(`${flowPath}.target.#order`)).toEqual(['x', 'a', 'y']);
  });

  it('selects the new names after moving into a parent with name conflicts', async () => {
    (Root.instance.queryValue(`${flowPath}.target`) as Block).createBlock('a').setValue('#is', childId);
    await render([`${flowPath}.source.a`]);
    await drag('a', 'target');
    await shouldHappen(() => Root.instance.queryValue(`${flowPath}.target.a1`) instanceof Block);
    await shouldHappen(() => selected.join(',') === `${flowPath}.target.a1`);
    expect(Root.instance.queryValue(`${flowPath}.target.#order`)).toEqual(['x', 'y', 'a1']);
    await shouldHappen(() => row('a1')?.classList.contains('ticl-tree-node-selected'));
  });

  it('rejects mixed parents, unordered children, incompatible tags and denied moves', async () => {
    await render([`${flowPath}.source.a`, `${flowPath}.target.x`]);
    const item = (name: string) => tree.list.find((item) => item.name === name);
    expect(tree.getOrderedDrag(item('a'))).toBeUndefined();
    simulate(row('a'), 'click');
    await shouldHappen(() => selected.length === 1);
    simulate(row('extra'), 'click', {ctrlKey: true});
    await shouldHappen(() => selected.length === 2);
    expect(tree.getOrderedDrag(item('a'))).toBeUndefined();
    simulate(row('a'), 'click');
    await shouldHappen(() => selected.length === 1);
    simulate(row('wrong'), 'click', {ctrlKey: true});
    await shouldHappen(() => selected.includes(`${flowPath}.source.wrong`));
    const items = tree.getOrderedDrag(item('a'));
    expect(items).toHaveLength(2);
    expect(tree.canDropOrdered(items, item('target'))).toBe(false);
    const move = vi.spyOn(client, 'moveOrdered');
    tree.onDropOrdered(items, item('target'));
    expect(move).not.toHaveBeenCalled();
    simulate(row('a'), 'click');
    await shouldHappen(() => selected.length === 1);
    server.setEditPolicy({denyCmds: ['moveOrdered']});
    await shouldHappen(
      () =>
        !client
          .getEditPolicyView()
          .can({cmd: 'moveOrdered', path: `${flowPath}.source`, props: ['a'], to: `${flowPath}.target`})
    );
    tree.onDropOrdered(tree.getOrderedDrag(item('a')), item('target'));
    expect(move).not.toHaveBeenCalled();
    expect(Root.instance.queryValue(`${flowPath}.source.a`)).toBeInstanceOf(Block);
  });

  it('loads hidden root order and tags for drops beside its children', async () => {
    await render([`${flowPath}.source.a`], `${flowPath}.source`, true);
    expect(tree.rootList[0].desc.childrenTags).toEqual(['component']);
    await drag('a', 'b', 0.1);
    await shouldHappen(() => (Root.instance.queryValue(`${flowPath}.source.#order`) as string[])[0] === 'a');
    await shouldHappen(() => Array.from(div.querySelectorAll('.ticl-tree-node-text'))[0]?.textContent === 'a');
    expect(
      Array.from(div.querySelectorAll('.ticl-tree-node-text'))
        .map((node) => node.textContent)
        .slice(0, 3)
    ).toEqual(['a', 'b', 'c']);
  });
});
