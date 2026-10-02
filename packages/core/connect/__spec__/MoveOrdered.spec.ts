import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {Root} from '../../block/Flow.ts';
import {Block} from '../../block/Block.ts';
import {globalFunctions} from '../../block/FunctionLib.ts';
import {makeLocalConnection} from '../LocalConnection.ts';
import type {EditPolicy} from '../../policy/EditPolicy.ts';

const parentId = 'test-ordered-parent';
const childId = 'test-ordered-child';

describe('Move ordered command', () => {
  let root: Root;
  let client: ReturnType<typeof makeLocalConnection>[1];
  let server: ReturnType<typeof makeLocalConnection>[0];

  beforeEach(() => {
    globalFunctions.addFactory(null, {
      id: parentId,
      name: parentId,
      tags: ['component'],
      childrenTags: ['component'],
      properties: [],
    });
    globalFunctions.addFactory(null, {id: childId, name: childId, tags: ['component'], properties: []});
    root = new Root();
    root.addFlow('Main', {
      value: 10,
      source: {
        '#is': parentId,
        '#order': ['b', 'a', 'a1'],
        'a': {'#is': childId, '~input': '##.##.value', '~sibling': '##.b.input'},
        'b': {'#is': childId, 'input': 20},
        'a1': {'#is': childId},
        'extra': {'#is': childId},
        'wrong': {'#is': 'add'},
        '~outside': 'a.input',
      },
      target: {
        '#is': parentId,
        '#order': ['x', 'y'],
        'x': {'#is': childId},
        'y': {'#is': childId},
        'inner': {'#is': parentId},
      },
    });
    root.addFlow('Other', {target: {'#is': parentId}});
    [server, client] = makeLocalConnection(root, false);
  });

  afterEach(() => {
    client.destroy();
    root.destroy();
    globalFunctions.delete(parentId);
    globalFunctions.delete(childId);
  });

  it('inserts in source order and updates both parents', async () => {
    expect((await client.moveOrdered('Main.source', ['a', 'b'], 'Main.target', 1)).moved).toEqual(['b', 'a']);
    expect(root.queryValue('Main.source.#order')).toEqual(['a1']);
    expect(root.queryValue('Main.target.#order')).toEqual(['x', 'b', 'a', 'y']);
    expect(root.queryValue('Main.target.a.sibling')).toBe(20);
    expect(root.queryValue('Main.source.a')).toBeUndefined();
    expect(root.queryProperty('Main.source.outside')._bindingPath).toBe('a.input');
  });

  it('appends into an unordered destination and uses move binding correction', async () => {
    expect((await client.moveOrdered('Main.source', ['a'], 'Main.target.inner')).moved).toEqual(['a']);
    expect(root.queryValue('Main.target.inner.#order')).toEqual(['a']);
    expect(root.queryProperty('Main.target.inner.a.input')._bindingPath).toBe('##.##.##.value');
    expect(root.queryValue('Main.target.inner.a.input')).toBe(10);
    await client.moveOrdered('Main.target.inner', ['a'], 'Other.target');
    expect(root.queryProperty('Other.target.a.input')._bindingPath).toBe('##.##.##.value');
  });

  it('renames conflicts without losing incoming names or their relative order', async () => {
    (root.queryValue('Main.target') as Block).createBlock('a').setValue('#is', childId);
    expect((await client.moveOrdered('Main.source', ['a1', 'a', 'b'], 'Main.target', 0)).moved).toEqual([
      'b',
      'a2',
      'a1',
    ]);
    expect(root.queryValue('Main.target.#order')).toEqual(['b', 'a2', 'a1', 'x', 'y']);
    expect(root.queryValue('Main.target.a2.input')).toBe(10);
    expect(root.queryValue('Main.target.a1')).toBeInstanceOf(Block);
    expect(root.queryValue('Main.target.a2.sibling')).toBe(20);
  });

  it('reorders in place without copying blocks or changing bindings', async () => {
    const source = root.queryValue('Main.source') as Block;
    const a = source.getValue('a');
    const save = vi.spyOn(a as Block, '_save');
    expect((await client.moveOrdered('Main.source', ['a', 'b'], 'Main.source', 3)).moved).toEqual(['b', 'a']);
    expect(source.getValue('#order')).toEqual(['a1', 'b', 'a']);
    expect(source.getValue('a')).toBe(a);
    expect(root.queryProperty('Main.source.a.input')._bindingPath).toBe('##.##.value');
    expect(save).not.toHaveBeenCalled();
    await client.moveOrdered('Main.source', ['a'], 'Main.source', 0);
    expect(source.getValue('#order')).toEqual(['a', 'a1', 'b']);
    await client.moveOrdered('Main.source', ['a'], 'Main.source');
    expect(source.getValue('#order')).toEqual(['a1', 'b', 'a']);
  });

  it('inserts each child once when the target order contains a deleted child name', async () => {
    (root.queryValue('Main.target') as Block).setValue('#order', ['a', 'x', 'y']);
    await client.moveOrdered('Main.source', ['a'], 'Main.target', 2);
    expect(root.queryValue('Main.target.#order')).toEqual(['x', 'a', 'y']);
  });

  it('rejects invalid children, tags, indices and descendants before any change', async () => {
    const source = root.queryValue('Main.source') as Block;
    const target = root.queryValue('Main.target') as Block;
    const original = source.getValue('a');
    const initialOrder = [...(source.getValue('#order') as string[])];
    for (const props of [[], ['a', 'a'], ['a', 'extra'], ['target.x'], ['missing']]) {
      await expect(client.moveOrdered('Main.source', props, 'Main.target')).rejects.toBe('invalid ordered children');
    }
    for (const index of [-1, 1.5, 3, NaN]) {
      await expect(client.moveOrdered('Main.source', ['a'], 'Main.target', index)).rejects.toBe('invalid index');
    }
    source.setValue('#order', [...initialOrder, 'wrong']);
    await expect(client.moveOrdered('Main.source', ['a', 'wrong'], 'Main.target')).rejects.toBe(
      'incompatible children tags'
    );
    await expect(client.moveOrdered('Main.source', ['a'], 'Main.source.a')).rejects.toBe('incompatible children tags');
    (original as Block).setValue('#is', parentId);
    await expect(client.moveOrdered('Main.source', ['a'], 'Main.source.a')).rejects.toBe(
      'cannot move blocks into their descendants'
    );
    target.setValue('#is', childId);
    await expect(client.moveOrdered('Main.source', ['a'], 'Main.target')).rejects.toBe('incompatible children tags');
    expect(source.getValue('a')).toBe(original);
    expect(source.getValue('#order')).toEqual([...initialOrder, 'wrong']);
    expect(target.getValue('#order')).toEqual(['x', 'y']);
  });

  it('enforces moveOrdered permissions and permits order-only edits in one parent', async () => {
    const original = root.queryValue('Main.source.a');
    const policies: EditPolicy[] = [
      {denyCmds: ['moveOrdered']},
      {allowDeleteBlock: false},
      {allowCreateBlock: false},
      {denyPaths: ['Main.source.#order']},
      {denyPaths: ['Main.target.#order']},
    ];
    for (const policy of policies) {
      server.setEditPolicy(policy);
      await expect(client.moveOrdered('Main.source', ['a'], 'Main.target')).rejects.toBeTypeOf('string');
      expect(root.queryValue('Main.source.a')).toBe(original);
    }
    server.setEditPolicy({
      allowCmds: ['moveOrdered'],
      allowProps: ['#order'],
      allowCreateBlock: false,
      allowDeleteBlock: false,
    });
    await client.moveOrdered('Main.source', ['a'], 'Main.source', 0);
    expect(root.queryValue('Main.source.#order')).toEqual(['a', 'b', 'a1']);
    (original as Block).setValue('reference', root.queryValue('Other'));
    server.setEditPolicy({allowCmds: ['moveOrdered'], allowPaths: ['Main', 'Main.**']});
    await expect(client.moveOrdered('Main.source', ['a'], 'Main.target')).rejects.toBe('restricted path');
    (original as Block).deleteValue('reference');
    expect((await client.moveOrdered('Main.source', ['a'], 'Main.target')).moved).toEqual(['a']);
  });
});
