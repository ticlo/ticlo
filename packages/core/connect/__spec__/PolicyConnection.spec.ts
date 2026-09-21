import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {Root} from '../../block/Flow.ts';
import {makeLocalConnection} from '../LocalConnection.ts';
import {ValueSubscriber} from '../ClientConn.ts';
import {PolicyConnection} from '../PolicyConnection.ts';
import {shouldHappen} from '../../util/test-util.ts';
import type {EditPolicy} from '../../policy/EditPolicy.ts';

describe('PolicyConnection', () => {
  let root: Root;
  let server: ReturnType<typeof makeLocalConnection>[0];
  let base: ReturnType<typeof makeLocalConnection>[1];

  beforeEach(() => {
    root = new Root();
    root.addFlow('Main', {value: 0, other: 0, source: 1});
    [server, base] = makeLocalConnection(root, false);
  });
  afterEach(() => {
    base.destroy();
    root.destroy();
  });

  it('creates independent immutable views sharing one base connection', async () => {
    const received = vi.spyOn(server, 'onData');
    const policy = {allowProps: ['value']};
    const a = base.withPolicy(policy);
    const b = base.withPolicy({allowProps: ['other']});
    const replacement = a.withPolicy({allowCmds: []});
    expect(a).toBeInstanceOf(PolicyConnection);
    expect(a.getBaseConn()).toBe(base);
    expect(b.getBaseConn()).toBe(base);
    expect(replacement.getBaseConn()).toBe(base);
    expect(a.withPolicy()).toBe(base);
    expect(received).not.toHaveBeenCalled();
    policy.allowProps.push('other');
    expect(a.getEditPolicyView().policy.allowProps).toEqual(['value']);
    expect(Reflect.set(a.getEditPolicyView().policy, 'allowProps', ['other'])).toBe(false);
    expect(Reflect.set(a.getEditPolicyView(), 'policy', {})).toBe(false);
    expect(a.getEditPolicyView().canWriteField('Main.value')).toBe(true);
    expect(replacement.getEditPolicyView().canWriteField('Main.value')).toBe(false);
    await a.setValue('Main.value', 2, true);
    await b.setValue('Main.other', 3, true);
    await expect(a.setValue('Main.other', 4, true)).rejects.toBe('restricted property');
    expect(root.queryValue('Main.value')).toBe(2);
    expect(root.queryValue('Main.other')).toBe(3);
    expect(base.getEditPolicyView().canWriteField('Main.other')).toBe(true);
  });

  it('does not let rejected edits cancel or overwrite another view’s queued edits', async () => {
    const a = base.withPolicy({allowProps: ['value']});
    const b = base.withPolicy({allowProps: ['other']});
    a.setValue('Main.value', 1);
    b.setValue('Main.value', 2);
    await expect(b.setValue('Main.value', 3, true)).rejects.toBe('restricted property');
    await base.getValue('Main.value');
    expect(root.queryValue('Main.value')).toBe(1);
    expect(base.setRequests.size).toBe(0);
    a.setValue('Main.value', 4);
    b.setValue('Main.other', 5);
    await base.getValue('Main.value');
    expect(root.queryValue('Main.value')).toBe(4);
    expect(root.queryValue('Main.other')).toBe(5);
  });

  it('shares subscriptions and preserves them when replacing a view', async () => {
    const a = base.withPolicy({allowProps: ['value']});
    const b = base.withPolicy({allowCmds: []});
    const first = {onUpdate: vi.fn()};
    const second = {onUpdate: vi.fn()};
    a.subscribe('Main.value', first);
    b.subscribe('Main.value', second);
    const subscriber = new ValueSubscriber({onUpdate: vi.fn()});
    subscriber.subscribe(a, 'Main.value');
    await shouldHappen(() => second.onUpdate.mock.calls.length > 0);
    const ids = Object.keys(server.requests);
    expect(ids).toHaveLength(1);
    subscriber.subscribe(a.withPolicy({}), 'Main.value');
    a.unsubscribe('Main.value', first);
    await base.setValue('Main.value', 2, true);
    await shouldHappen(() => second.onUpdate.mock.calls.length > 1);
    expect(first.onUpdate).toHaveBeenCalledTimes(1);
    expect(Object.keys(server.requests)).toEqual(ids);
    b.unsubscribe('Main.value', second);
    subscriber.unsubscribe();
    await shouldHappen(() => Object.keys(server.requests).length === 0);
  });

  it('shows only the view policy while server restrictions still return request errors', async () => {
    const view = base.withPolicy({allowProps: ['value']});
    const changed = vi.fn();
    view.editPolicyChanges().listen(changed);
    expect(view.getEditPolicyView().ready).toBe(true);
    server.setEditPolicy({allowCmds: []});
    await base.getValue('Main.value');
    expect(changed).not.toHaveBeenCalled();
    expect(view.getEditPolicyView().canWriteField('Main.value')).toBe(true);
    expect(base.getEditPolicyView().canWriteField('Main.value')).toBe(false);
    expect(base.checkEditRequest({cmd: 'set', path: 'Main.value'})).toBeNull();
    await expect(view.setValue('Main.value', 1, true)).rejects.toBe('restricted command');
    server.setEditPolicy({allowProps: ['other']});
    await base.getValue('Main.value');
    expect(view.withPolicy().getEditPolicyView().canWriteField('Main.other')).toBe(true);
    expect(view.withPolicy().getEditPolicyView().canWriteField('Main.value')).toBe(false);
    base.onDisconnect();
    expect(base.getEditPolicyView().ready).toBe(false);
    expect(view.getEditPolicyView().ready).toBe(true);
    base.reconnect();
    await shouldHappen(() => base.getEditPolicyView().ready);
    expect(base.getEditPolicyView().canWriteField('Main.value')).toBe(false);
    expect(view.getBaseConn()).toBe(base);
  });

  for (const mode of ['client', 'server'] as const) {
    it(`${mode} preserves binding overrides and promise/callback errors`, async () => {
      const policy: EditPolicy = {allowBinding: ['value'], allowProps: ['other'], denyProps: ['value']};
      if (mode === 'server') server.setEditPolicy(policy);
      const client = mode === 'client' ? base.withPolicy(policy) : base;
      const received = vi.spyOn(server, 'onData');
      await client.setBinding('Main.value', 'source', false, true);
      expect(root.queryProperty('Main.value')._bindingPath).toBe('source');
      await client.paste('Main', {'~value': 'other'});
      await expect(client.setBinding('Main.other', 'source', false, true)).rejects.toBe('restricted binding');
      await expect(client.paste('Main', {'~other': 'source'})).rejects.toBe('restricted binding');
      await expect(client.setValue('Main.value', 2, true)).rejects.toBe('restricted property');
      await new Promise<void>((resolve) => {
        client.setValue('Main.value', 3, {
          onError: (error) => {
            expect(error).toBe('restricted property');
            resolve();
          },
        });
      });
      expect(received.mock.calls.some(([request]) => request.cmd === 'set' && request.path === 'Main.value')).toBe(
        mode === 'server'
      );
      await client.setValue('Main.other', 4, true);
      expect(root.queryValue('Main.other')).toBe(4);
      expect(base.requests.size).toBe(0);
    });

    it(`${mode} leaves undo/redo exempt from non-path editing limits`, async () => {
      root.deleteFlow('Main');
      const flow = root.addFlow('Main');
      flow.load({value: 1}, null, () => flow.save());
      base.watch('Main', {});
      await base.setValue('Main.value', 2, true);
      await base.applyFlowChange('Main');
      const policy: EditPolicy = {
        allowCmds: [],
        allowProps: [],
        allowDeleteBlock: false,
        allowPaths: mode === 'client' ? [] : ['Main.**'],
        readonlyPaths: ['Main'],
      };
      if (mode === 'server') server.setEditPolicy(policy);
      const client = mode === 'client' ? base.withPolicy(policy) : base;
      await client.undo('Main');
      expect(flow.getValue('value')).toBe(1);
      await client.redo('Main');
      expect(flow.getValue('value')).toBe(2);
    });
  }
});
