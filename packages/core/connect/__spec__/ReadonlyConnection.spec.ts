import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {Root, Flow} from '../../block/Flow.ts';
import {Block} from '../../block/Block.ts';
import {globalFunctions} from '../../block/FunctionModule.ts';
import type {DataMap} from '../../util/DataTypes.ts';
import {makeLocalConnection} from '../LocalConnection.ts';
import {AsyncClientPromise} from './AsyncClientPromise.ts';

describe('Readonly server connection', () => {
  let root: Root;
  let server: ReturnType<typeof makeLocalConnection>[0];
  let client: ReturnType<typeof makeLocalConnection>[1];

  beforeEach(() => {
    root = new Root();
    root.addFlow('Main', {value: 1});
    root.addFlow('Other', {value: 5, child: {'#is': '', 'value': 6}});
    [server, client] = makeLocalConnection(root, false, {readonly: true});
  });

  afterEach(() => {
    client.destroy();
    root.destroy();
  });

  it('serves reads and subscription updates while rejecting writes after reconnect', async () => {
    const view = client.withPolicy({allowPaths: ['Main'], denyCmds: ['get', 'query']});
    const callbacks = new AsyncClientPromise();
    try {
      expect((await view.getValue('Other.value')).value).toBe(5);
      expect((await view.query('Other', {child: {'?values': ['value']}})).value).toEqual({child: {value: 6}});
      expect((await view.copy('Other', ['child'])).value.child.value).toBe(6);
      await expect(view.setValue('Main.value', 2, true)).rejects.toBe('readonly');
      view.subscribe('Other.value', callbacks);
      expect((await callbacks.promise).cache.value).toBe(5);
      const update = callbacks.promise;
      client.onDisconnect();
      client.reconnect();
      (root.queryValue('Other') as Block).setValue('value', 7);
      expect((await update).cache.value).toBe(7);
      expect(view.getEditPolicyView().canWriteField('Main.value')).toBe(true);
      await expect(view.setValue('Main.value', 2, true)).rejects.toBe('readonly');
      expect(root.queryValue('Main.value')).toBe(1);
    } finally {
      callbacks.cancel();
    }
  });

  it('rejects all editing commands before resolving paths or inspecting payloads', () => {
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
      'copyCustomPropDesc',
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
      'setAutoLoadFlow',
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
    const writableOnly = vi.fn();
    const id = 'readonly-command-test';
    globalFunctions.addFactory(
      null,
      {
        name: id,
        properties: [{name: 'value', type: 'number', commands: {write: {parameters: [], readonly: true}}}],
        commands: {inspect: {parameters: [], readonly: true}, writableOnly: {parameters: []}},
      },
      undefined,
      {commands: {inspect, write, writableOnly}}
    );
    const main = root.queryValue('Main') as Flow;
    const block = main.createBlock('command');
    block.setValue('#is', id);
    block.setValue('value', 1);
    const [, writable] = makeLocalConnection(root, false);
    try {
      expect((await client.executeCommand('Main.command', 'inspect')).result).toEqual({readonly: true, value: 1});
      expect(
        (await client.executeCommand('Main.command', 'inspect', {property: 'value', readonly: false})).result
      ).toEqual({readonly: true, property: 'value', value: 1});
      expect(
        server.executeRequest({cmd: 'executeCommand', path: 'Main.command', command: 'inspect', readonly: false})
      ).toEqual({result: {readonly: true, property: undefined, value: 1}});
      await expect(client.executeCommand('Main.command', 'writableOnly')).rejects.toBe('readonly');
      expect(writableOnly).not.toHaveBeenCalled();
      const track = vi.spyOn(root.queryValue('Main') as Flow, 'trackChange');
      await client.executeCommand('Main.command', 'write', {property: 'value', value: 2});
      expect(write).toHaveBeenLastCalledWith(root.queryValue('Main.command'), {property: 'value', value: 2}, true);
      expect(root.queryValue('Main.command.value')).toBe(1);
      expect(track).not.toHaveBeenCalled();
      await writable.executeCommand('Main.command', 'write', {property: 'value', value: 3});
      expect(write).toHaveBeenLastCalledWith(root.queryValue('Main.command'), {property: 'value', value: 3}, false);
      expect(root.queryValue('Main.command.value')).toBe(3);
      expect(track).toHaveBeenCalled();
      track.mockRestore();
    } finally {
      writable.destroy();
      globalFunctions.delete(id);
    }
  });
});
