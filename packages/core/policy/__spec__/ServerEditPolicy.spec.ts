import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {Root, Flow} from '../../block/Flow.ts';
import {Block} from '../../block/Block.ts';
import {globalFunctions} from '../../block/FunctionLib.ts';
import type {DataMap} from '../../util/DataTypes.ts';
import {makeLocalConnection} from '../../connect/LocalConnection.ts';
import {shouldHappen} from '../../util/test-util.ts';
import {checkEditPolicy, type EditPolicy} from '../EditPolicy.ts';

describe('Readonly server edit policy', () => {
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
      server.setEditPolicy({readonly: true, ...policy});
      expect(server.executeRequest(request)).toBe('restricted path');
    }
    // Simple read commands still ignore command/field limits on the server.
    server.setEditPolicy({readonly: true, ...policy, denyCmds: ['get'], allowProps: []});
    expect((await client.getValue('Main.value')).value).toBe(1);
    await expect(client.getValue('Other.value')).rejects.toBe('restricted path');
    await expect(client.getValue('Main')).rejects.toBe('restricted path');
  });

  it('combines read paths and readonly paths while denying every edit', async () => {
    server.setEditPolicy({
      readonly: true,
      allowPaths: ['Main.**'],
      readonlyPaths: ['Main', 'Other', 'Other.**'],
      denyPaths: ['Other.child.**'],
    });
    expect((await client.getValue('Other.value')).value).toBe(5);
    expect((await client.list('Main')).children.child).toBeDefined();
    await expect(client.setValue('Main.value', 7, true)).rejects.toBe('readonly');
    await expect(client.setValue('Other.value', 7, true)).rejects.toBe('readonly');
    await expect(client.getValue('Other.child.value')).rejects.toBe('restricted path');
    expect(client.getEditPolicyView().canWriteField('Main.value')).toBe(false);
    expect(client.getEditPolicyView().canWriteField('Other.value')).toBe(false);
    server.setEditPolicy({readonly: true, readonlyPaths: ['Main.**']});
    expect((await client.getValue('Other.value')).value).toBe(5);
  });

  it('does not grant ancestor reads or let settings use a spoofed allowed path', async () => {
    server.setEditPolicy({readonly: true, allowPaths: ['Main.**']});
    await expect(client.list('')).rejects.toBe('restricted path');
    expect(server.executeRequest({cmd: 'getSettings', path: 'Main.value'})).toBe('restricted path');
    server.setEditPolicy({readonly: true, allowPaths: ['Main.**'], readonlyPaths: ['']});
    expect(typeof server.executeRequest({cmd: 'getSettings', path: ''})).toBe('object');
  });

  it('rejects all editing commands before resolving paths or inspecting payloads', () => {
    server.setEditPolicy({readonly: true, allowPaths: ['**']});
    const query = vi.spyOn(root, 'queryBlockField');
    for (const cmd of [
      'set',
      'update',
      'bind',
      'restoreSaved',
      'addBlock',
      'deleteBlock',
      'addFlow',
      'addFlowFolder',
      'paste',
      'move',
      'moveOrdered',
      'renameProp',
      'showProps',
      'hideProps',
      'moveShownProp',
      'setLen',
      'addCustomProp',
      'removeCustomProp',
      'moveCustomProp',
      'addOptionalProp',
      'removeOptionalProp',
      'moveOptionalProp',
      'insertGroupProp',
      'removeGroupProp',
      'moveGroupProp',
      'editWorker',
      'applyFlowChange',
      'deleteFunction',
      'callFunction',
      'loadFlow',
      'unloadFlow',
      'enableFlow',
      'disableFlow',
      'undo',
      'redo',
    ]) {
      expect(server.executeRequest({cmd, path: 'Main', value: 123})).toBe('readonly');
    }
    expect(server.executeRequest({cmd: 'copy', path: 'Main', props: ['value'], cut: true})).toBe('readonly');
    expect(query).not.toHaveBeenCalled();
    query.mockRestore();
    expect(root.queryValue('Main.value')).toBe(1);
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
      server.setEditPolicy({readonly: true, ...policy});
      await expect(client.query('Main', query)).rejects.toBe('restricted command');
    }
    server.setEditPolicy({readonly: true, allowCmds: ['query']});
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
      server.setEditPolicy({readonly: true, ...policy});
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
        readonly: true,
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
    server.setEditPolicy({readonly: true, ...policy});
    await expect(client.query('Main.reference', {'?values': ['value']})).rejects.toBe('restricted path');
    await expect(client.getValue('Main.reference.value')).rejects.toBe('restricted path');
    server.setEditPolicy({readonly: true, ...policy, readonlyPaths: ['**'], denyPaths: ['Main.reference.value']});
    await expect(client.query('Main.reference', {'?values': ['value']})).rejects.toBe('restricted path');
    server.setEditPolicy({readonly: true, ...policy, readonlyPaths: ['**'], denyPaths: ['Other.child.value']});
    await expect(client.query('Main.reference', {'?values': ['value']})).rejects.toBe('restricted path');
    server.setEditPolicy({readonly: true, ...policy, readonlyPaths: ['**']});
    expect((await client.query('Main.reference', {'?values': ['value']})).value).toEqual({value: 6});
  });

  it('does not follow references outside an authorized query subtree', async () => {
    const main = root.queryValue('Main') as Block;
    const child = main.getValue('child') as Block;
    const outside = root.queryValue('Other.child') as Block;
    main.setValue('reference', outside);
    child.setValue('reference', outside);
    main.setValue('inside', child);
    server.setEditPolicy({readonly: true, allowPaths: [], readonlyPaths: ['Main', 'Main.**']});
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
    server.setEditPolicy({
      readonly: true,
      allowPaths: [],
      readonlyPaths: ['Main', 'Main.**'],
      denyPaths: ['Main.child.hidden'],
    });
    expect((await client.copy('Main', ['value'])).value).toEqual({
      'value': 1,
      '#_copy_from': 'Main',
    });
    await expect(client.copy('Main', ['child'])).rejects.toBe('restricted path');
    await expect(client.copy('Main', ['value'], true)).rejects.toBe('readonly');
    expect(root.queryValue('Main.value')).toBe(1);
    server.setEditPolicy({readonly: true, allowPaths: [], readonlyPaths: ['Main', 'Main.**']});
    expect((await client.copy('Main', ['child'])).value.child.value).toBe(3);
  });

  it('revokes existing subscriptions and drops queued values when policy changes', async () => {
    server.setEditPolicy({readonly: true, allowPaths: [], readonlyPaths: ['Main', 'Main.**']});
    const onUpdate = vi.fn();
    const onError = vi.fn();
    client.subscribe('Main.value', {onUpdate, onError});
    client.watch('Main', {onError});
    await shouldHappen(() => onUpdate.mock.calls.length > 0 && Object.keys(server.requests).length === 2);
    onUpdate.mockClear();
    (root.queryValue('Main') as Block).setValue('value', 10);
    server.setEditPolicy({readonly: true, allowPaths: []});
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
    server.setEditPolicy({
      readonly: true,
      allowPaths: [],
      readonlyPaths: ['Main', 'Main.**'],
      denyPaths: ['Main.~value.hidden'],
    });
    await expect(client.copy('Main', ['value'])).rejects.toBe('restricted path');
    await expect(client.copy('Main', ['reference'])).rejects.toBe('restricted path');
    (main.getValue('child') as Block).setValue('reference', root.queryValue('Other.child'));
    await expect(client.copy('Main', ['child'])).rejects.toBe('restricted path');
  });

  it('skips server policy checks for writable policies, including subscriptions and copies', async () => {
    const policy: EditPolicy = {
      readonly: false,
      allowPaths: [],
      readonlyPaths: [],
      denyPaths: ['**'],
      allowCmds: [],
      allowProps: [],
      allowBinding: [],
      allowBlockTypes: [],
      allowCreateBlock: false,
      allowDeleteBlock: false,
      allowChangeBlockType: false,
    };
    server.setEditPolicy(policy);
    const check = vi.spyOn(server as any, 'checkRequestPolicy');
    expect((await client.getValue('Other.value')).value).toBe(5);
    await client.setValue('Other.value', 7, true);
    await client.paste('Main', {hidden: 8});
    expect((await client.copy('Main', ['child'])).value.child.value).toBe(3);
    await client.addBlock('Main.new', {'#is': 'add'}, true);
    await client.deleteBlock('Main.child');
    const onUpdate = vi.fn();
    client.subscribe('Other.value', {onUpdate});
    await shouldHappen(() => onUpdate.mock.calls.length > 0);
    server.setEditPolicy({...policy, readonly: undefined});
    await client.setValue('Other.value', 9, true);
    await shouldHappen(() => onUpdate.mock.calls.length > 1);
    expect(check).not.toHaveBeenCalled();
    expect(root.queryValue('Other.value')).toBe(9);
    expect(root.queryValue('Main.hidden')).toBe(8);
    expect(root.queryValue('Main.child')).toBeUndefined();
    expect(client.getEditPolicyView().canWriteField('Other.value')).toBe(false);
  });

  it('passes the authoritative readonly flag to function and property commands', async () => {
    const inspect = vi.fn((block: Block, params: DataMap, readonly: boolean) => ({
      readonly,
      property: params?.property,
      value: block.getValue('value'),
    }));
    const write = vi.fn((block: Block, params: DataMap, readonly: boolean) => {
      if (readonly) return;
      block.setValue('value', params.value);
    });
    const id = 'readonly-command-test';
    globalFunctions.addFactory(
      null,
      {
        name: id,
        properties: [{name: 'value', type: 'number', commands: {inspect: {parameters: []}, write: {parameters: []}}}],
        commands: {inspect: {parameters: []}, write: {parameters: []}},
      },
      undefined,
      {commands: {inspect, write}}
    );
    try {
      await client.addBlock('Main.command', {'#is': id, 'value': 1});
      server.setEditPolicy({readonly: true, allowPaths: ['Main', 'Main.**']});
      expect((await client.executeCommand('Main.command', 'inspect')).result).toEqual({readonly: true, value: 1});
      expect(
        (await client.executeCommand('Main.command', 'inspect', {property: 'value', readonly: false})).result
      ).toEqual({readonly: true, property: 'value', value: 1});
      expect(
        server.executeRequest({cmd: 'executeCommand', path: 'Main.command', command: 'inspect', readonly: false})
      ).toEqual({result: {readonly: true, property: undefined, value: 1}});
      const track = vi.spyOn(root.queryValue('Main') as Flow, 'trackChange');
      await client.executeCommand('Main.command', 'write', {property: 'value', value: 2});
      expect(write).toHaveBeenLastCalledWith(root.queryValue('Main.command'), {property: 'value', value: 2}, true);
      expect(root.queryValue('Main.command.value')).toBe(1);
      expect(track).not.toHaveBeenCalled();
      server.setEditPolicy({allowCmds: [], allowProps: [], denyPaths: ['Main.**']});
      await client.executeCommand('Main.command', 'write', {property: 'value', value: 3});
      expect(write).toHaveBeenLastCalledWith(root.queryValue('Main.command'), {property: 'value', value: 3}, false);
      expect(root.queryValue('Main.command.value')).toBe(3);
      expect(track).toHaveBeenCalled();
      track.mockRestore();
      server.setEditPolicy({readonly: true, allowPaths: ['Other.**']});
      await expect(client.executeCommand('Main.command', 'inspect')).rejects.toBe('restricted path');
      expect(inspect).toHaveBeenCalledTimes(3);
    } finally {
      globalFunctions.delete(id);
    }
  });
});
