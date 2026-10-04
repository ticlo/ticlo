import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {Root} from '../../block/Flow.ts';
import {Block} from '../../block/Block.ts';
import {makeLocalConnection} from '../LocalConnection.ts';
import type {EditPolicy} from '../../policy/EditPolicy.ts';

describe('Move command', () => {
  let root: Root;
  let client: ReturnType<typeof makeLocalConnection>[1];
  let server: ReturnType<typeof makeLocalConnection>[0];

  beforeEach(() => {
    root = new Root();
    root.addFlow('Main', {
      value: 10,
      source: {
        '#is': '',
        'a': {'#is': '', '~input': '##.##.value', '~external': '##.##.##.Other.value'},
        '~outside': 'a.input',
      },
      target: {'#is': '', 'inner': {'#is': ''}},
    });
    root.addFlow('Other', {value: 20});
    [server, client] = makeLocalConnection(root, false);
  });

  afterEach(() => {
    client.destroy();
    root.destroy();
  });

  it('transports copy metadata and corrects bindings in a deeper parent', async () => {
    const copied = (await client.copy('Main.source', ['a'])).value;
    expect((await client.paste('Main.target.inner', copied)).pasted).toEqual(['a']);
    expect(root.queryProperty('Main.target.inner.a.input')._bindingPath).toBe('##.##.##.value');
    expect(root.queryValue('Main.target.inner.a.input')).toBe(10);
    expect(root.queryProperty('Main.target.inner.a.external')._bindingPath).toBe('##.##.##.##.Other.value');
    expect(root.queryValue('Main.target.inner.a.external')).toBe(20);
    expect(root.queryValue('Main.source.a')).toBeInstanceOf(Block);
  });

  it('moves between different parents, leaving bindings elsewhere unchanged', async () => {
    expect((await client.move('Main.source', ['a'], 'Main.target.inner')).moved).toEqual(['a']);
    expect(root.queryValue('Main.source.a')).toBeUndefined();
    expect(root.queryProperty('Main.source.outside')._bindingPath).toBe('a.input');
    expect(root.queryValue('Main.source.outside')).toBeUndefined();
    expect(root.queryProperty('Main.target.inner.a.input')._bindingPath).toBe('##.##.##.value');
    expect(root.queryValue('Main.target.inner.a.input')).toBe(10);
    await expect(client.move('Main.target.inner', ['a'], 'Main.target.inner')).rejects.toBe(
      'source and target parents must be different'
    );
  });

  it('keeps cross-flow paths unchanged and tracks changes in both flows', async () => {
    const main = root.queryValue('Main') as Block;
    const other = root.queryValue('Other') as Block;
    const sourceChange = vi.spyOn(main._flow, 'trackChange');
    const targetChange = vi.spyOn(other._flow, 'trackChange');
    expect((await client.move('Main.source', ['a'], 'Other')).moved).toEqual(['a']);
    expect(root.queryProperty('Other.a.input')._bindingPath).toBe('##.##.value');
    expect(sourceChange).toHaveBeenCalled();
    expect(targetChange).toHaveBeenCalled();
  });

  it('rejects conflicts and invalid destinations without removing the source', async () => {
    await client.addBlock('Main.target.a', {'#is': ''});
    const original = root.queryValue('Main.source.a');
    await expect(client.move('Main.source', ['a'], 'Main.target')).rejects.toMatch(/^block already exists:/);
    await expect(client.move('Main.source', ['a'], 'Main.missing')).rejects.toBe('invalid path');
    await expect(client.move('Main.source', ['a'], 'Main.source.a')).rejects.toBe(
      'cannot move blocks into their descendants'
    );
    expect(root.queryValue('Main.source.a')).toBe(original);
    expect((await client.move('Main.source', ['a'], 'Main.target', 'rename')).moved).toEqual(['a1']);
  });

  it('checks client command, deletion, creation and destination permissions before moving', async () => {
    const original = root.queryValue('Main.source.a');
    const policies: EditPolicy[] = [
      {denyCmds: ['move']},
      {allowDeleteBlock: false},
      {allowCreateBlock: false},
      {allowPaths: ['Main.target']},
      {allowPaths: ['Main.source']},
    ];
    for (const policy of policies) {
      await expect(client.withPolicy(policy).move('Main.source', ['a'], 'Main.target')).rejects.toBeTypeOf('string');
      expect(root.queryValue('Main.source.a')).toBe(original);
      expect(root.queryValue('Main.target.a')).toBeUndefined();
    }
    (original as Block).setValue('reference', root.queryValue('Other'));
    server.setEditPolicy({allowPaths: ['Main', 'Main.**']});
    expect(
      (
        await client
          .withPolicy({allowPaths: ['Main'], denyPaths: ['Main.target.**']})
          .move('Main.source', ['a'], 'Main.target')
      ).moved
    ).toEqual(['a']);
    expect(root.queryValue('Main.source.a')).toBeUndefined();
    expect(root.queryValue('Main.target.a')).toBeInstanceOf(Block);
  });
});
