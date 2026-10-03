import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {Block, deleteBlock, Root, type Flow} from '../../index.ts';
import {makeLocalConnection} from '../LocalConnection.ts';
import {EditPolicyView, type EditPolicy} from '../../policy/EditPolicy.ts';
import {FlowEditor} from '../../worker/FlowEditor.ts';
import {shouldHappen} from '../../util/test-util.ts';

describe('Delete block command', () => {
  let root: Root;
  let flow: Flow;
  let parent: Block;
  let client: ReturnType<typeof makeLocalConnection>[1];
  let server: ReturnType<typeof makeLocalConnection>[0];

  beforeEach(() => {
    root = new Root();
    flow = root.addFlow(
      'Main',
      {
        parent: {
          '#is': '',
          '#order': ['a', 'b', 'missing', 'a'],
          'a': {'#is': '', 'nested': {'#is': ''}},
          'b': {'#is': ''},
          'extra': {'#is': ''},
          'value': 1,
        },
      },
      {applyChange: (flow) => flow.save()}
    );
    parent = flow.getValue('parent') as Block;
    [server, client] = makeLocalConnection(root, false);
  });

  afterEach(() => {
    client.destroy();
    root.destroy();
  });

  it('removes every matching order entry and restores the block and order together on undo', async () => {
    flow.startHistory();
    const b = parent.getValue('b');
    await client.deleteBlock('Main.parent.a');
    expect(parent.getValue('a')).toBeUndefined();
    expect(parent.getValue('b')).toBe(b);
    expect(parent.getValue('#order')).toEqual(['b', 'missing']);
    expect(flow.getValue('@has-change')).toBe(true);
    await client.undo('Main');
    expect(root.queryValue('Main.parent.a.nested')).toBeInstanceOf(Block);
    expect(root.queryValue('Main.parent.#order')).toEqual(['a', 'b', 'missing', 'a']);
    await client.redo('Main');
    expect(root.queryValue('Main.parent.a')).toBeUndefined();
    expect(root.queryValue('Main.parent.#order')).toEqual(['b', 'missing']);
  });

  it('supports callbacks last and leaves order untouched for an unordered block', async () => {
    const order = parent.getValue('#order');
    const setOrder = vi.spyOn(parent.getProperty('#order'), 'setValue');
    await new Promise<void>((resolve, reject) => {
      client.deleteBlock('Main.parent.extra', {onDone: resolve, onError: reject});
    });
    expect(parent.getValue('extra')).toBeUndefined();
    expect(parent.getValue('#order')).toBe(order);
    expect(setOrder).not.toHaveBeenCalled();
    parent.setValue('#order', 'invalid');
    await client.deleteBlock('Main.parent.b');
    expect(parent.getValue('#order')).toBe('invalid');
  });

  it('exposes the helper without requiring a connection and leaves low-level deletion unchanged', async () => {
    deleteBlock(parent, 'a');
    expect(parent.getValue('a')).toBeUndefined();
    expect(parent.getValue('#order')).toEqual(['b', 'missing']);
    parent.deleteValue('b');
    expect(parent.getValue('#order')).toEqual(['b', 'missing']);
    parent.createBlock('b');
    await client.setValue('Main.parent.b', undefined, true);
    expect(parent.getValue('#order')).toEqual(['b', 'missing']);
  });

  it('cleans the actual parent behind references without deleting a referenced block', async () => {
    flow.setValue('reference', parent);
    await client.deleteBlock('Main.reference.a');
    expect(parent.getValue('a')).toBeUndefined();
    expect(parent.getValue('#order')).toEqual(['b', 'missing']);
    parent.setBinding('alias', 'b');
    parent.setValue('#order', ['alias', 'b']);
    const b = parent.getValue('b');
    await client.deleteBlock('Main.parent.alias');
    expect(parent.getValue('alias')).toBeUndefined();
    expect(parent.getValue('b')).toBe(b);
    expect(parent.getValue('#order')).toEqual(['b']);
  });

  it('tracks static child deletion on the edited worker flow', async () => {
    const editor = FlowEditor.createFromFunction(flow, '#edit-worker', ':delete-static', {
      '#is': '',
      '#static': {'#is': '', '#order': ['a'], 'a': {'#is': ''}},
    });
    await client.deleteBlock('Main.#edit-worker.#static.a');
    expect(editor.queryValue('#static.a')).toBeUndefined();
    expect(editor.queryValue('#static.#order')).toEqual([]);
    expect(editor.getValue('@has-change')).toBe(true);
    expect(flow.getValue('@has-change')).toBeUndefined();
  });

  it('rejects invalid paths and non-block properties without changing order', async () => {
    for (const path of ['Main.missing.a', 'Main.parent.missing']) {
      await expect(client.deleteBlock(path)).rejects.toBe('invalid path');
    }
    await expect(client.deleteBlock('Main.parent.value')).rejects.toBe('invalid block');
    expect(parent.getValue('value')).toBe(1);
    expect(parent.getValue('#order')).toEqual(['a', 'b', 'missing', 'a']);
  });

  it('checks client command, subtree, deletion and order permissions', async () => {
    const policies: EditPolicy[] = [
      {denyCmds: ['deleteBlock']},
      {allowDeleteBlock: false},
      {denyPaths: ['Main.parent.a.nested']},
      {denyPaths: ['Main.parent.#order']},
      {denyProps: ['#order']},
    ];
    const original = parent.getValue('a');
    for (const policy of policies) {
      await expect(client.withPolicy(policy).deleteBlock('Main.parent.a')).rejects.toBeTypeOf('string');
      expect(parent.getValue('a')).toBe(original);
      expect(parent.getValue('#order')).toEqual(['a', 'b', 'missing', 'a']);
    }
    flow.setValue('reference', parent);
    await expect(
      client.withPolicy({denyPaths: ['Main.reference.#order']}).deleteBlock('Main.reference.a')
    ).rejects.toBe('restricted path');
    expect(parent.getValue('a')).toBe(original);
    expect(new EditPolicyView({denyCmds: ['deleteBlock']}).canDeleteBlock('Main.parent.a')).toBe(false);
    expect(new EditPolicyView({allowCmds: ['deleteBlock']}).canDeleteBlock('Main.parent.a')).toBe(true);
    server.setEditPolicy({allowCmds: ['deleteBlock'], allowPaths: ['Main.**']});
    await client.deleteBlock('Main.parent.a');
    expect(parent.getValue('#order')).toEqual(['b', 'missing']);
  });

  it('waits for Flow persistence and keeps the block and order when deletion fails', async () => {
    root.setValue('#order', ['Main', 'missing']);
    let finish: () => void;
    const deleting = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        })
    );
    root._storage = {delete: deleting} as any;
    let done = false;
    const result = (client.deleteBlock('Main') as Promise<unknown>).then(() => {
      done = true;
    });
    await shouldHappen(() => deleting.mock.calls.length === 1);
    expect(done).toBe(false);
    expect(root.getValue('Main')).toBe(flow);
    expect(root.getValue('#order')).toEqual(['Main', 'missing']);
    finish();
    await result;
    expect(root.getValue('Main')).toBeUndefined();
    expect(root.getValue('#order')).toEqual(['missing']);
    root.addFlow('Main', {}, {});
    root.setValue('#order', ['Main', 'missing']);
    root._storage.delete = async () => {
      throw new Error('delete failed');
    };
    await expect(client.deleteBlock('Main')).rejects.toContain('delete failed');
    expect(root.getValue('Main')).toBeInstanceOf(Block);
    expect(root.getValue('#order')).toEqual(['Main', 'missing']);
  });
});
