import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {Root} from '../../block/Flow.ts';
import {Block} from '../../block/Block.ts';
import {makeLocalConnection} from '../../connect/LocalConnection.ts';
import {shouldHappen} from '../../util/test-util.ts';
import {checkEditPolicy, type EditPolicy, EditPolicyView} from '../EditPolicy.ts';

describe('Server edit policy paths', () => {
  let root: Root;
  let server: ReturnType<typeof makeLocalConnection>[0];
  let client: ReturnType<typeof makeLocalConnection>[1];

  beforeEach(() => {
    root = new Root();
    root.addFlow('Main', {value: 1, hidden: 2, child: {'#is': '', 'value': 3, 'hidden': 4}});
    root.addFlow('Other', {value: 5, child: {'#is': '', 'value': 6}});
    [server, client] = makeLocalConnection(root, false);
  });

  afterEach(() => {
    client.destroy();
    root.destroy();
  });

  it('keeps client reads unrestricted but checks server paths for every read command', async () => {
    const policy: EditPolicy = {allowPaths: ['Main.**'], allowCmds: ['query']};
    const restricted = client.withPolicy(policy);
    expect((await restricted.getValue('Other.value')).value).toBe(5);
    for (const cmd of ['get', 'list', 'query', 'subscribe', 'watch', 'watchDesc', 'getSettings', 'copy']) {
      const request = {cmd, path: 'Other', id: cmd, props: ['value'], query: {}};
      expect(checkEditPolicy(policy, request)).toBeNull();
      server.setEditPolicy(policy);
      expect(server.executeRequest(request)).toBe('restricted path');
    }
    // Simple read commands still ignore command/field limits on the server.
    server.setEditPolicy({...policy, denyCmds: ['get'], allowProps: []});
    expect((await client.getValue('Main.value')).value).toBe(1);
    await expect(client.getValue('Other.value')).rejects.toBe('restricted path');
    await expect(client.getValue('Main')).rejects.toBe('restricted path');
  });

  it('adds readonly access without reducing writable paths, while denyPaths wins', async () => {
    const policy = {
      allowPaths: ['Main.**'],
      readonlyPaths: ['Main', 'Main.**', 'Other', 'Other.**'],
      denyPaths: ['Other.child.**'],
    };
    server.setEditPolicy(policy);
    expect((await client.getValue('Other.value')).value).toBe(5);
    expect((await client.list('Main')).children.child).toBeDefined();
    await client.setValue('Main.value', 7, true);
    expect((await client.getValue('Main.value')).value).toBe(7);
    await expect(client.setValue('Other.value', 7, true)).rejects.toBe('restricted path');
    await expect(client.getValue('Other.child.value')).rejects.toBe('restricted path');
    await expect(client.setValue('Other.child.value', 7, true)).rejects.toBe('restricted path');
    const view = client.getEditPolicyView();
    expect(view.canWriteField('Main.value')).toBe(true);
    expect(view.canWriteField('Other.value')).toBe(false);
    expect(view.canDeleteBlock('Main')).toBe(false);
    // With no allowPaths list, the existing default still permits all paths.
    expect(new EditPolicyView({readonlyPaths: ['Main.**']}).canWriteField('Main.value')).toBe(true);
    server.setEditPolicy({...policy, denyPaths: ['Main.value']});
    await expect(client.getValue('Main.value')).rejects.toBe('restricted path');
  });

  it('does not grant ancestor reads or let settings use a spoofed allowed path', async () => {
    server.setEditPolicy({allowPaths: ['Main.**']});
    await expect(client.list('')).rejects.toBe('restricted path');
    expect(server.executeRequest({cmd: 'getSettings', path: 'Main.value'})).toBe('restricted path');
    server.setEditPolicy({allowPaths: ['Main.**'], readonlyPaths: ['']});
    expect(typeof server.executeRequest({cmd: 'getSettings', path: ''})).toBe('object');
  });

  it('protects the flow node while allowing edits and deletions inside it', async () => {
    server.setEditPolicy({allowPaths: ['Main.**'], readonlyPaths: ['Main']});
    const flow = root.queryValue('Main');
    for (const cmd of ['set', 'update', 'bind', 'restoreSaved', 'addFlow', 'addFlowFolder', 'applyFlowChange']) {
      expect(server.executeRequest({cmd, path: 'Main', value: 123})).toBe('restricted path');
    }
    await expect(client.setValue('Main', undefined, true)).rejects.toBe('restricted path');
    expect(root.queryValue('Main')).toBe(flow);
    await client.setValue('Main.value', 9, true);
    await client.setValue('Main.child', undefined, true);
    expect(root.queryValue('Main.value')).toBe(9);
    expect(root.queryValue('Main.child')).toBeUndefined();
  });

  it('requires query command permission only on the server', async () => {
    const query = {'?values': ['value']};
    const restricted = client.withPolicy({allowPaths: [], denyCmds: ['query']});
    expect((await restricted.query('Main', query)).value).toEqual({value: 1});
    const policies: EditPolicy[] = [
      {allowCmds: []},
      {denyCmds: ['query']},
      {allowCmds: ['query'], denyCmds: ['query']},
    ];
    for (const policy of policies) {
      server.setEditPolicy(policy);
      await expect(client.query('Main', query)).rejects.toBe('restricted command');
    }
    server.setEditPolicy({allowCmds: ['query']});
    expect((await client.query('Main', query)).value).toEqual({value: 1});
  });

  it('rejects query before execution unless the entire subtree is readable', async () => {
    const query = vi.spyOn(server, 'query');
    const policies: EditPolicy[] = [
      {allowPaths: ['Main']},
      {allowPaths: ['Main', 'Main.*']},
      {allowPaths: ['Main.**']},
      {allowPaths: [], readonlyPaths: ['Main', 'Main.value']},
      {allowPaths: ['Main', 'Main.**'], denyPaths: ['Main.hidden']},
      {allowPaths: ['Main', 'Main.**'], denyPaths: ['Main.child.hidden']},
      {allowPaths: ['Main', 'Main.**'], denyPaths: ['Main.child?.hidden']},
      {allowPaths: ['Main', 'Main.**'], denyPaths: ['**.hidden']},
    ];
    for (const policy of policies) {
      server.setEditPolicy(policy);
      // Even a query that only selects readable fields requires the whole subtree.
      await expect(client.query('Main', {'?values': ['value']})).rejects.toBe('restricted path');
    }
    expect(query).not.toHaveBeenCalled();
    query.mockRestore();
  });

  it('accepts whole-subtree reads from writable and readonly paths despite editing limits', async () => {
    const paths: EditPolicy[] = [
      {},
      {allowPaths: ['Main', 'Main.**']},
      {allowPaths: [], readonlyPaths: ['Main', 'Main.**']},
      {allowPaths: ['Main.**'], readonlyPaths: ['Main']},
      {allowPaths: ['Main'], readonlyPaths: ['Main.**']},
    ];
    for (const policy of paths) {
      server.setEditPolicy({
        ...policy,
        denyPaths: ['Other.**'],
        allowCmds: ['query'],
        allowProps: [],
        allowBlockTypes: [],
        allowCreateBlock: false,
      });
      expect((await client.query('Main', {'?values': ['/value/'], 'child': {'?values': ['value']}})).value).toEqual({
        value: 1,
        child: {value: 3},
      });
    }
  });

  it('checks the whole subtree at the actual owner when the query starts at a reference', async () => {
    const main = root.queryValue('Main') as Block;
    main.setValue('reference', root.queryValue('Other.child'));
    const policy: EditPolicy = {allowPaths: [], readonlyPaths: ['Main', 'Main.**']};
    server.setEditPolicy(policy);
    await expect(client.query('Main.reference', {'?values': ['value']})).rejects.toBe('restricted path');
    await expect(client.getValue('Main.reference.value')).rejects.toBe('restricted path');
    server.setEditPolicy({...policy, readonlyPaths: ['**'], denyPaths: ['Main.reference.value']});
    await expect(client.query('Main.reference', {'?values': ['value']})).rejects.toBe('restricted path');
    server.setEditPolicy({...policy, readonlyPaths: ['**'], denyPaths: ['Other.child.value']});
    await expect(client.query('Main.reference', {'?values': ['value']})).rejects.toBe('restricted path');
    server.setEditPolicy({...policy, readonlyPaths: ['**']});
    expect((await client.query('Main.reference', {'?values': ['value']})).value).toEqual({value: 6});
  });

  it('does not follow references outside an authorized query subtree', async () => {
    const main = root.queryValue('Main') as Block;
    const child = main.getValue('child') as Block;
    const outside = root.queryValue('Other.child') as Block;
    main.setValue('reference', outside);
    child.setValue('reference', outside);
    main.setValue('inside', child);
    server.setEditPolicy({allowPaths: [], readonlyPaths: ['Main', 'Main.**']});
    const values = {'?values': ['value']};
    expect(
      (
        await client.query('Main', {
          'reference': values,
          '/reference/': values,
          '##': {Other: {child: values}},
          'inside': {reference: values, ...values},
        })
      ).value
    ).toEqual({inside: {value: 3}});
    expect((await client.query('Main.child', {'##': values, '#flow': values, ...values})).value).toEqual({value: 3});
  });

  it('checks the full copied subtree and does not let readonly access authorize cutting', async () => {
    server.setEditPolicy({allowPaths: [], readonlyPaths: ['Main', 'Main.**'], denyPaths: ['Main.child.hidden']});
    expect((await client.copy('Main', ['value'])).value).toEqual({value: 1});
    await expect(client.copy('Main', ['child'])).rejects.toBe('restricted path');
    await expect(client.copy('Main', ['value'], true)).rejects.toBe('restricted path');
    expect(root.queryValue('Main.value')).toBe(1);
    server.setEditPolicy({allowPaths: [], readonlyPaths: ['Main', 'Main.**']});
    expect((await client.copy('Main', ['child'])).value.child.value).toBe(3);
  });

  it('revokes existing subscriptions and drops queued values when policy changes', async () => {
    server.setEditPolicy({allowPaths: [], readonlyPaths: ['Main', 'Main.**']});
    const onUpdate = vi.fn();
    const onError = vi.fn();
    client.subscribe('Main.value', {onUpdate, onError});
    client.watch('Main', {onError});
    await shouldHappen(() => onUpdate.mock.calls.length > 0 && Object.keys(server.requests).length === 2);
    onUpdate.mockClear();
    (root.queryValue('Main') as Block).setValue('value', 10);
    server.setEditPolicy({allowPaths: []});
    await shouldHappen(() => onError.mock.calls.length === 2);
    expect(onError.mock.calls.every(([error]) => error === 'restricted path')).toBe(true);
    expect(onUpdate).not.toHaveBeenCalled();
    expect(Object.keys(server.requests)).toHaveLength(0);
    // Closing a request remains allowed after its path access is revoked.
    server.onData({cmd: 'close', id: 'already-closed'});
  });

  it('checks saved block owners and binding helper paths when copying', async () => {
    const main = root.queryValue('Main') as Block;
    main.setValue('reference', root.queryValue('Other.child'));
    main.createHelperBlock('value').setValue('hidden', 10);
    server.setEditPolicy({allowPaths: [], readonlyPaths: ['Main', 'Main.**'], denyPaths: ['Main.~value.hidden']});
    await expect(client.copy('Main', ['value'])).rejects.toBe('restricted path');
    await expect(client.copy('Main', ['reference'])).rejects.toBe('restricted path');
    (main.getValue('child') as Block).setValue('reference', root.queryValue('Other.child'));
    await expect(client.copy('Main', ['child'])).rejects.toBe('restricted path');
  });

  it('checks the actual flow history and refuses undo/redo when any descendants are restricted', async () => {
    root.deleteFlow('Main');
    const flow = root.addFlow('Main');
    flow.load({value: 1, child: {'#is': '', 'value': 3}}, null, () => flow.save());
    client.watch('Main', {});
    await client.setValue('Main.value', 2, true);
    await client.applyFlowChange('Main');
    const policy: EditPolicy = {allowPaths: ['Main.**'], readonlyPaths: ['Main'], allowCmds: []};
    server.setEditPolicy({...policy, denyPaths: ['Main.child.value']});
    await expect(client.undo('Main')).rejects.toBe('restricted path');
    expect(flow.getValue('value')).toBe(2);
    server.setEditPolicy({...policy, allowPaths: ['Main.child.**']});
    await expect(client.undo('Main.child')).rejects.toBe('restricted path');
    expect(flow.getValue('value')).toBe(2);
    server.setEditPolicy(policy);
    await client.undo('Main');
    expect(flow.getValue('value')).toBe(1);
    server.setEditPolicy({...policy, allowPaths: [], readonlyPaths: ['Main', 'Main.**']});
    await expect(client.redo('Main')).rejects.toBe('restricted path');
    expect(flow.getValue('value')).toBe(1);
    server.setEditPolicy(policy);
    await client.redo('Main');
    expect(flow.getValue('value')).toBe(2);
  });
  it('checks the parent namespace before generating a name, even if the requested name is free', async () => {
    const main = root.queryValue('Main') as Block;
    const properties = [...main._props.keys()];
    const policies: EditPolicy[] = [
      {allowPaths: ['Main.add', 'Main.add.**']},
      {allowPaths: ['Main.add*', 'Main.add*.**']},
      {allowPaths: ['Main', 'Main.*']},
      {allowPaths: [], readonlyPaths: ['Main', 'Main.**']},
      {allowPaths: ['Main.**'], denyPaths: ['Main.unrelated.**']},
    ];
    for (const policy of policies) {
      server.setEditPolicy(policy);
      await expect(client.addBlock('Main.add', {'#is': 'add'}, true)).rejects.toBe('restricted path');
      expect([...main._props.keys()]).toEqual(properties);
    }
    // An explicitly chosen name does not require access to its siblings.
    server.setEditPolicy(policies[0]);
    await client.addBlock('Main.add', {'#is': 'add'});
    expect(root.queryValue('Main.add')).toBeInstanceOf(Block);
  });

  it('generates names after permission checks without treating the existing block as a replacement', async () => {
    const main = root.queryValue('Main') as Block;
    const original = main.createBlock('add');
    const nested = original.createBlock('nested');
    server.setEditPolicy({
      allowPaths: ['Main.**'],
      allowBlockTypes: ['add'],
      allowDeleteBlock: false,
      allowProps: ['#is', 'nested'],
    });
    expect((await client.addBlock('Main.add', {'#is': 'add', 'nested': 1}, true)).name).toBe('add1');
    expect(original.getValue('nested')).toBe(nested);
    expect(root.queryValue('Main.add1.nested')).toBe(1);
  });

  it('rejects automatic naming and compound writes before any mutation', async () => {
    const root = new Root();
    const flow = root.addFlow('Main');
    flow.createBlock('add');
    const [, client] = makeLocalConnection(root, false, {allowPaths: ['Main.add.**']});
    try {
      await expect(client.addBlock('Main.add', {'#is': 'add'}, true)).rejects.toBe('restricted path');
      expect(flow.getProperty('add1', false)).toBeFalsy();
      await expect(client.paste('Main', {allowed: 1, forbidden: 2})).rejects.toBe('restricted path');
      expect(flow.getProperty('allowed', false)).toBeFalsy();
      expect(flow.getProperty('forbidden', false)).toBeFalsy();
    } finally {
      client.destroy();
      root.destroy();
    }
  });

  it('checks the owner of a referenced block before changing its contents', async () => {
    const root = new Root();
    const flow = root.addFlow('Main');
    const other = root.addFlow('Other');
    const block = other.createBlock('add');
    flow.setValue('reference', block);
    const [, client] = makeLocalConnection(root, false, {allowPaths: ['Main.**']});
    try {
      await expect(client.setValue('Main.reference.value', 1, true)).rejects.toBe('restricted path');
      await expect(client.paste('Main.reference', {value: 2})).rejects.toBe('restricted path');
      expect(block.getValue('value')).toBeUndefined();
    } finally {
      client.destroy();
      root.destroy();
    }
  });

  it('allows paste with renamed blocks when deletion is disabled', async () => {
    const root = new Root();
    const flow = root.addFlow('Main');
    const original = flow.createBlock('add');
    const [, client] = makeLocalConnection(root, false, {allowDeleteBlock: false});
    try {
      await client.paste('Main', {add: {'#is': 'add'}}, 'rename');
      expect(flow.getValue('add')).toBe(original);
      expect(flow.getValue('add1')).toBeDefined();
    } finally {
      client.destroy();
      root.destroy();
    }
  });
});
