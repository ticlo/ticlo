import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import '../../index.ts';
import {BlockIO, BlockConfig} from '../BlockProperty.ts';
import {Root} from '../Flow.ts';
import {MemoryFlowStorage} from '../MemoryFlowStorage.ts';
import {makeLocalConnection} from '../../connect/LocalConnection.ts';
import {escapedObject} from '../../util/NoSerialize.ts';
import {moveBlocks} from '../../property-api/CopyPaste.ts';
import {removeGroupProperty} from '../../property-api/GroupProperty.ts';

describe('code-defined global blocks', () => {
  let root: Root;
  let storage: MemoryFlowStorage;
  beforeEach(() => {
    root = new Root();
    storage = new MemoryFlowStorage();
  });
  afterEach(async () => {
    await root.stop({discardChanges: true});
    root.destroy();
  });

  it('exists before storage reads and merges only fields not defined by code', async () => {
    const settings = {names: ['original']};
    const service = escapedObject('host-service', {call: () => 42});
    const host = root.defineGlobal('host', {
      '#is': 'add',
      'port': 8010,
      settings,
      'nested': {'#is': '', 'fixed': 7},
      'helperTarget': 8,
      'unset': undefined,
      '#output': service,
    });
    storage.saveFlow(
      null,
      {
        '^host': {
          '#is': 'subtract',
          'port': 9999,
          '~port': '^other',
          'settings': {names: ['saved']},
          'unset': 17,
          'nested': {'#is': '', 'fixed': 9, 'extra': 'saved nested value'},
          'extra': 'saved value',
          '~helperTarget': {'#is': 'add', 0: 1, 1: 2},
          '#output': 'saved output',
        },
        '~^host': {'#is': 'add', 0: 1, 1: 2},
      },
      '#global'
    );
    const load = storage.loadFlow.bind(storage);
    vi.spyOn(storage, 'loadFlow').mockImplementation((path) => {
      expect(root.queryValue('#global.^host.port')).toBe(8010);
      return load(path);
    });
    await root.setStorage(storage);
    root.addFlow('consumer', {
      '~port': '^host.port',
      '~service': '^host.#output',
      '~name': '^host.settings.names.0',
    });
    root.runAll();
    expect(root.queryValue('consumer.port')).toBe(8010);
    expect(root.queryValue('consumer.service')).toBe(service);
    expect(root.queryValue('consumer.name')).toBe('original');
    expect(host.getValue('helperTarget')).toBe(8);
    expect(host.getProperty('~helperTarget', false)).toBeNull();
    expect(root._globalRoot.getProperty('~^host', false)).toBeNull();
    expect(host.getValue('unset')).toBeUndefined();
    expect(host.getProperty('unset').isCleared()).toBe(false);
    host._liveUpdate({'~helperTarget': {'#is': 'add', 0: 3, 1: 4}}, false);
    expect(host.getProperty('~helperTarget', false)).toBeNull();
    expect(host.getValue('#is')).toBe('add');
    expect(host.getFunctionClass()).toBeUndefined();
    expect(host.getValue('extra')).toBe('saved value');
    expect(host.queryValue('nested.fixed')).toBe(7);
    expect(host.queryValue('nested.extra')).toBe('saved nested value');
    expect(host.getProperty('port')).toBeInstanceOf(BlockIO);
    expect(host.getProperty('#is')).toBeInstanceOf(BlockConfig);
    settings.names.push('changed outside the runtime');
    expect(host.getValue('settings')).toEqual({names: ['original']});
    expect(Object.isFrozen(host.getValue('settings'))).toBe(true);
    expect(Object.isFrozen((host.getValue('settings') as typeof settings).names)).toBe(true);
  });

  it('rejects edits, deletion and renaming without changing bindings or their targets', async () => {
    const host = root.defineGlobal('^host', {'#is': '', 'port': 8010});
    host.setValue('editable', 4);
    const [, client] = makeLocalConnection(root, false);
    try {
      for (const request of [
        {cmd: 'set', path: '#global.^host.port', value: 1},
        {cmd: 'set', path: '#global.^host.#is', value: 'add'},
        {cmd: 'set', path: '#global.^host', value: 1},
        {cmd: 'deleteBlock', path: '#global.^host'},
        {cmd: 'renameProp', path: '#global.^host.port', newName: 'editable'},
        {cmd: 'renameProp', path: '#global.^host.editable', newName: 'port'},
      ]) {
        await expect(client.simpleRequest(request)).rejects.toContain('read-only');
      }
      await client.simpleRequest({cmd: 'bind', path: '#global.^host.port', from: 'editable'});
      expect(host.getProperty('port')._bindingPath).toBeUndefined();
      expect(host.getValue('port')).toBe(8010);
      const source = root.addFlow('source', {port: {'#is': '', 'value': 'keep'}});
      const original = source.getValue('port');
      expect(moveBlocks(source, host, ['port'], 'overwrite')).toContain('read-only');
      expect(source.getValue('port')).toBe(original);
      const group = root.defineGlobal('group', {'#is': 'add', 0: 'fixed'});
      group.setValue('1', 'keep');
      expect(() => removeGroupProperty(group, '', 0)).toThrow('read-only');
      expect(group.getValue('1')).toBe('keep');
      expect(host.getValue('editable')).toBe(4);
      expect(root.queryValue('#global.^host')).toBe(host);
      expect(host.getProperty('port').updateValue(2)).toBe(false);
      expect(host.getProperty('port').setOutput(3)).toBe(false);
      expect(host.getValue('port')).toBe(8010);
    } finally {
      client.destroy();
    }
  });

  it('saves only editable additions and retains code definitions across reload, stop and restart', async () => {
    const host = root.defineGlobal('^host', {
      '#is': 'web-server:server',
      'port': 8010,
      'nested': {'#is': '', 'fixed': 7},
    });
    await root.setStorage(storage);
    await root.start();
    host.setValue('editable', 'user value');
    (host.getValue('nested') as typeof host).setValue('extra', 3);
    await root._globalRoot.applyChange();
    expect(await storage.loadFlow('#global')).toEqual({
      '#is': '',
      '^host': {'#is': '', 'editable': 'user value', 'nested': {'#is': '', 'extra': 3}},
    });
    await root.stop();
    await root.start();
    expect(root.queryValue('#global.^host')).toBe(host);
    expect(host.getValue('port')).toBe(8010);
    root._globalRoot.liveUpdate({'#is': ''});
    expect(host.getValue('editable')).toBeUndefined();
    expect(host.queryValue('nested.extra')).toBeUndefined();
    expect(host.queryValue('nested.fixed')).toBe(7);
    expect(root._globalRoot.save()).toEqual({'#is': ''});
  });

  it('defines globals before storage initialization and never replaces a code definition', async () => {
    expect(() => root.defineGlobal('invalid', {'#is': {}})).toThrow('function ID string');
    const host = root.defineGlobal('^host', {port: 8010});
    expect(() => root.defineGlobal('^host', {port: 9999})).toThrow('already in use');
    expect(host.getValue('port')).toBe(8010);
    await root.setStorage(storage);
    expect(() => root.defineGlobal('^late', {})).toThrow('before loading storage');
  });
});
