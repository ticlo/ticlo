import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {Root, type Flow} from '../../block/Flow.ts';
import {Block} from '../../block/Block.ts';
import {globalFunctions} from '../../block/FunctionLib.ts';
import {makeLocalConnection} from '../LocalConnection.ts';

const parentId = 'test-add-parent';
const childId = 'test-add-child';
const wrongId = 'test-add-wrong';

describe('Add block with orderIndex', () => {
  let root: Root;
  let client: ReturnType<typeof makeLocalConnection>[1];
  let server: ReturnType<typeof makeLocalConnection>[0];

  beforeEach(() => {
    globalFunctions.addFactory(null, {id: parentId, name: parentId, childrenTags: ['component'], properties: []});
    globalFunctions.addFactory(null, {id: childId, name: childId, tags: ['component'], properties: []});
    globalFunctions.addFactory(null, {id: wrongId, name: wrongId, tags: ['other'], properties: []});
    root = new Root();
    root.addFlow('Main', {
      parent: {'#is': parentId, '#order': ['a', 'b'], 'a': {'#is': childId}, 'b': {'#is': childId}},
      empty: {'#is': parentId},
      leaf: {'#is': childId},
    });
    [server, client] = makeLocalConnection(root, false);
  });

  afterEach(() => {
    client.destroy();
    root.destroy();
    for (const id of [parentId, childId, wrongId]) globalFunctions.delete(id);
  });

  it('preserves ordinary creation with callbacks as the last argument', async () => {
    await new Promise<void>((resolve, reject) => {
      client.addBlock('Main.parent.normal', {'#is': wrongId}, true, undefined, {
        onUpdate: () => resolve(),
        onError: reject,
      });
    });
    expect(root.queryValue('Main.parent.normal')).toBeInstanceOf(Block);
    expect(root.queryValue('Main.parent.#order')).toEqual(['a', 'b']);
  });

  it('creates and inserts a child at the requested position without assigning stage coordinates', async () => {
    expect((await client.addBlock('Main.parent.new', {'#is': childId, 'value': 42}, true, 1)).name).toBe('new');
    expect(root.queryValue('Main.parent.#order')).toEqual(['a', 'new', 'b']);
    const child = root.queryValue('Main.parent.new') as Block;
    expect(child.getValue('#is')).toBe(childId);
    expect(child.getValue('value')).toBe(42);
    expect(child._save()).not.toHaveProperty('@b-xyw');
  });

  it('uses the generated name in #order and creates the first ordered child', async () => {
    const original = root.queryValue('Main.parent.a');
    expect((await client.addBlock('Main.parent.a', {'#is': childId}, true, 2)).name).toBe('a1');
    expect(root.queryValue('Main.parent.#order')).toEqual(['a', 'b', 'a1']);
    expect(root.queryValue('Main.parent.a')).toBe(original);
    (root.queryValue('Main.empty') as Block).setValue('#disabled', true);
    await client.addBlock('Main.empty.first', {'#is': childId}, true, 0);
    expect(root.queryValue('Main.empty.#order')).toEqual(['first']);
  });

  it('avoids duplicate order entries when reusing a deleted child name', async () => {
    (root.queryValue('Main.parent') as Block).setValue('#order', ['new', 'a', 'b']);
    await client.addBlock('Main.parent.new', {'#is': childId}, true, 3);
    expect(root.queryValue('Main.parent.#order')).toEqual(['a', 'b', 'new']);
  });

  it('rejects invalid indices, orders and tags before creating a child', async () => {
    for (const index of [-1, 0.5, 3, NaN]) {
      await expect(client.addBlock('Main.parent.new', {'#is': childId}, true, index)).rejects.toBe('invalid index');
    }
    for (const type of [wrongId, 'missing-function']) {
      await expect(client.addBlock('Main.parent.new', {'#is': type}, true, 1)).rejects.toBe(
        'incompatible children tags'
      );
    }
    await expect(client.addBlock('Main.leaf.new', {'#is': childId}, true, 0)).rejects.toBe(
      'incompatible children tags'
    );
    expect(root.queryValue('Main.parent.new')).toBeUndefined();
    expect(root.queryValue('Main.parent.#order')).toEqual(['a', 'b']);
    (root.queryValue('Main.parent') as Block).setValue('#order', 1);
    await expect(client.addBlock('Main.parent.new', {'#is': childId}, true, 0)).rejects.toBe('invalid order');
    expect(root.queryValue('Main.parent.new')).toBeUndefined();
  });

  it('checks #order permissions, including the owner behind a reference', async () => {
    const parent = root.queryValue('Main.parent') as Block;
    const properties = [...parent._props.keys()];
    for (const policy of [{denyProps: ['#order']}, {denyPaths: ['Main.parent.#order']}, {allowCreateBlock: false}]) {
      server.setEditPolicy(policy);
      await expect(client.addBlock('Main.parent.new', {'#is': childId}, true, 1)).rejects.toBeTypeOf('string');
      expect([...parent._props.keys()]).toEqual(properties);
    }
    (root.queryValue('Main') as Block).setValue('reference', parent);
    server.setEditPolicy({denyProps: ['#order']});
    await expect(client.addBlock('Main.reference.new', {'#is': childId}, false, 1)).rejects.toBe('restricted property');
    expect(root.queryValue('Main.parent.new')).toBeUndefined();
    server.setEditPolicy({allowCmds: ['addBlock'], allowProps: ['#is', '#order']});
    await client.addBlock('Main.parent.new', {'#is': childId}, true, 1);
    expect(root.queryValue('Main.parent.#order')).toEqual(['a', 'new', 'b']);
  });

  it('resolves child tags in the destination flow function library', async () => {
    const flow = root.queryValue('Main') as Flow;
    flow.getFuncLib().addFactory(null, {id: ':child', name: 'child', tags: ['component'], properties: []});
    await client.addBlock('Main.parent.local', {'#is': ':child'}, true, 1);
    expect(root.queryValue('Main.parent.#order')).toEqual(['a', 'local', 'b']);
  });
});
