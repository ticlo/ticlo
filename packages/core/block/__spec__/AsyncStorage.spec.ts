import {afterEach, describe, expect, it, vi} from 'vitest';
import {DataMap, Root} from '@ticlo/core';
import {makeLocalConnection} from '../../connect/LocalConnection.ts';
import {shouldHappen} from '../../util/test-util.ts';
import {Namespace} from '../Namespace.ts';
import {FlowEditor} from '../../worker/FlowEditor.ts';
import {WorkerFunctionGen} from '../../worker/WorkerFunctionGen.ts';
import {getGlobalFunctionRoot} from '../FunctionLib.ts';

function deferred<T>() {
  let resolve: (value: T) => void;
  let reject: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return {promise, resolve, reject};
}

describe('asynchronous persistence', () => {
  let root: Root;
  afterEach(() => root?.destroy());

  it.each([false, true])('reuses synchronous save data with history=%s', (history) => {
    root = new Root();
    const flow = root.addFlow('flow', {value: 1}, {applyChange: (flow) => flow.save()});
    if (history) flow.startHistory();
    flow.setValue('value', 2);
    flow.trackChange();
    flow.updateValue('@save-error', 'previous failure');
    const save = vi.spyOn(flow, 'save');

    const result = flow.applyChange();

    expect(result).not.toBeInstanceOf(Promise);
    expect(result).toMatchObject({value: 2});
    // Saving locally should traverse the flow only once, inside the storage callback.
    expect(save).toHaveBeenCalledTimes(1);
    expect(flow.getValue('@has-change')).toBeUndefined();
    expect(flow.getValue('@save-error')).toBeUndefined();
    if (history) {
      flow.undo();
      expect(flow.getValue('value')).toBe(1);
      expect(flow.getValue('@has-change')).toBe(true);
    }
  });

  it('preserves edits made during an asynchronous save without history', async () => {
    root = new Root();
    const pending = deferred<DataMap>();
    const flow = root.addFlow('flow', {value: 1}, {applyChange: () => pending.promise});
    flow.setValue('value', 2);
    flow.trackChange();
    const snapshot = flow.save();
    const saving = flow.applyChange();
    flow.setValue('value', 3);
    flow.trackChange();

    pending.resolve(snapshot);
    await saving;

    expect(flow.getValue('value')).toBe(3);
    expect(flow.getValue('@has-change')).toBe(true);
    flow._applyChange = async () => flow.save();
    await flow.applyChange();
    expect(flow.getValue('@has-change')).toBeUndefined();
  });

  it('reports synchronous save failures and retains dirty state', () => {
    root = new Root();
    const flow = root.addFlow(
      'flow',
      {value: 1},
      {
        applyChange: () => {
          throw new Error('write failed');
        },
      }
    );
    flow.setValue('value', 2);
    flow.trackChange();

    expect(() => flow.applyChange()).toThrow('write failed');
    expect(flow.getValue('@has-change')).toBe(true);
    expect(flow.getValue('@save-error')).toContain('write failed');
  });

  it('waits for a saved snapshot and preserves later edits and undo history', async () => {
    root = new Root();
    const pending = deferred<DataMap>();
    const flow = root.addFlow('flow', {value: 1}, {applyChange: () => pending.promise});
    flow.startHistory();
    flow.setValue('value', 2);
    flow.trackChange();
    const snapshot = flow.save();
    const saving = flow.applyChange();
    expect(flow.getValue('@has-change')).toBe(true);
    flow.setValue('value', 3);
    flow.trackChange();
    pending.resolve(snapshot);
    await saving;
    expect(flow.getValue('value')).toBe(3);
    expect(flow.getValue('@has-change')).toBe(true);
    expect(flow._history._savedData.value).toBe(2);
    flow._applyChange = async () => flow.save();
    await flow.applyChange();
    expect(flow.getValue('@has-change')).toBeUndefined();
    flow.undo();
    expect(flow.getValue('@has-change')).toBe(true);
  });

  it('reports a rejected save without clearing dirty state', async () => {
    root = new Root();
    const flow = root.addFlow(
      'flow',
      {value: 1},
      {
        applyChange: async () => {
          throw new Error('conflict');
        },
      }
    );
    flow.startHistory();
    flow.setValue('value', 2);
    flow.trackChange();
    await expect(flow.applyChange()).rejects.toThrow('conflict');
    expect(flow.getValue('@has-change')).toBe(true);
    expect(flow.getValue('@save-error')).toContain('conflict');
    expect(flow._history._savedData.value).toBe(1);
  });

  it('sends connection success or failure only after persistence finishes', async () => {
    root = new Root();
    const pending = deferred<DataMap>();
    let called = false;
    const flow = root.addFlow(
      'flow',
      {value: 1},
      {
        applyChange: () => {
          called = true;
          return pending.promise;
        },
      }
    );
    const [, client] = makeLocalConnection(root, false);
    try {
      let done = false;
      const saving = (client.applyFlowChange('flow') as Promise<unknown>).then(() => {
        done = true;
      });
      await shouldHappen(() => called);
      expect(done).toBe(false);
      pending.resolve(flow.save());
      await saving;
      expect(done).toBe(true);
      flow._applyChange = async () => {
        throw new Error('upload failed');
      };
      await expect(client.applyFlowChange('flow')).rejects.toContain('upload failed');
    } finally {
      client.destroy();
    }
  });

  it('keeps a flow present when its remote deletion fails', async () => {
    root = new Root();
    const flow = root.addFlow('flow', {value: 1});
    root._storage = {
      delete: async () => {
        throw new Error('delete failed');
      },
    } as any;
    const [, client] = makeLocalConnection(root, false);
    try {
      await expect(client.setValue('flow', undefined, true)).rejects.toContain('delete failed');
      expect(root.getValue('flow')).toBe(flow);
      root._storage.delete = async () => {};
      await client.setValue('flow', undefined, true);
      expect(root.getValue('flow')).toBeUndefined();
    } finally {
      client.destroy();
    }
  });

  it('waits for library worker persistence and keeps failed edits dirty', async () => {
    root = new Root();
    let nextSave = Promise.resolve();
    Namespace.setStorage({loadLib: async (): Promise<DataMap> => null, saveLib: () => nextSave} as any);
    const ns = '+asyncStorage';
    const id = `${ns}:library:worker`;
    try {
      const lib = Namespace.getFunctionLib(id);
      await Promise.resolve();
      WorkerFunctionGen.registerType({'#is': ''}, {id, name: 'worker'}, ns, lib);
      const flow = root.addFlow('flow');
      const editor = FlowEditor.createFromFunction(flow, '#edit-worker', id, null);
      editor.startHistory();
      editor.setValue('value', 1);
      editor.trackChange();
      const pending = deferred<void>();
      nextSave = pending.promise;
      const saving = editor.applyChange();
      expect(editor.getValue('@has-change')).toBe(true);
      pending.resolve();
      await saving;
      expect(editor.getValue('@has-change')).toBeUndefined();
      editor.setValue('value', 2);
      editor.trackChange();
      nextSave = Promise.reject(new Error('library conflict'));
      await expect(editor.applyChange()).rejects.toThrow('library conflict');
      expect(editor.getValue('@has-change')).toBe(true);
    } finally {
      Namespace.setStorage(undefined);
      delete Namespace._dict[ns];
      getGlobalFunctionRoot().deleteValue(ns);
    }
  });
});
