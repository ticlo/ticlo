import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {Block, BlockAddon, deleteBlock, globalFunctions, Root, type Flow} from '../../index.ts';
import {renameProperty} from '../PropertyName.ts';
import '../../functions/math/Arithmetic.ts';
import '../../functions/system/Log.ts';
import {makeLocalConnection} from '../../connect/LocalConnection.ts';
import {checkEditPolicy} from '../../policy/EditPolicy.ts';

describe('Block addon', () => {
  let root: Root;
  let flow: Flow;
  let addBlock: Block;
  let client: ReturnType<typeof makeLocalConnection>[1];

  beforeEach(() => {
    root = new Root();
    flow = root.addFlow(
      'Main',
      {
        add: {'#is': 'add', '0': 1, '1': 2},
      },
      {applyChange: (f) => f.save()}
    );
    addBlock = flow.getValue('add') as Block;
    [, client] = makeLocalConnection(root, false);
  });

  afterEach(() => {
    client.destroy();
    root.destroy();
    vi.restoreAllMocks();
  });

  it('tags log as an addon', () => {
    expect(globalFunctions.getDesc('log')?.tags).toContain('addon');
  });

  it('uses BlockAddon for #- properties and does not broadcast #addon or #- children on #outputs', () => {
    const prop = addBlock.getProperty('#-log');
    expect(prop).toBeInstanceOf(BlockAddon);

    const inputSpy = vi.spyOn(addBlock, 'inputChanged');
    const configSpy = vi.spyOn(addBlock, 'configChanged');
    const addon = addBlock.createBlock('#-log');
    addon.setValue('#is', 'log');
    addBlock.setValue('#addon', ['#-log']);
    expect(inputSpy).not.toHaveBeenCalled();
    expect(configSpy).not.toHaveBeenCalled();

    const workerFlow = root.addFlow('Worker', {
      '#is': '',
      '#outputs': {
        '#is': '',
        'value': 42,
        '#-log': {'#is': 'log'},
        '#addon': ['#-log'],
      },
    });
    expect(workerFlow.getValue('value')).toBeUndefined();
    expect(workerFlow.queryValue('#outputs.#-log')).toBeInstanceOf(Block);
    expect(workerFlow.getValue('#-log')).toBeUndefined();
    expect(workerFlow.getValue('#addon')).toBeUndefined();
  });

  it('adds addons via addBlock, maintains #addon, binds #call to ##.#emit, and executes on parent emit', async () => {
    const write = vi.fn();
    flow.startHistory();

    const res1 = await client.addBlock(
      'Main.add.#-log',
      {'#is': 'log', '#mode': 'onCall', '~#call': '##.#emit', 'message': 'first'},
      true
    );
    expect(res1.name).toBe('#-log');
    expect(addBlock.getValue('#addon')).toEqual(['#-log']);

    const addon1 = addBlock.getValue('#-log') as Block;
    expect(addon1).toBeInstanceOf(Block);
    expect(addon1.getValue('#mode')).toBe('onCall');
    expect(addon1.getProperty('#call')._bindingPath).toBe('##.#emit');

    addon1.updateValue('provider', {write});
    root.runAll();
    expect(write).not.toHaveBeenCalled();

    addBlock.updateValue('#call', {});
    root.runAll();
    expect(write).toHaveBeenCalledTimes(1);
    expect(write.mock.calls[0][0]).toMatchObject({
      message: 'first',
      blockPath: 'Main.add.#-log',
      originPath: 'Main.add',
    });

    flow._history._trackChangeCallback.flush();

    const res2 = await client.addBlock(
      'Main.add.#-log',
      {'#is': 'log', '#mode': 'onCall', '~#call': '##.#emit', 'message': 'second'},
      true
    );
    expect(res2.name).toBe('#-log1');
    expect(addBlock.getValue('#addon')).toEqual(['#-log', '#-log1']);

    await client.undo('Main');
    expect(addBlock.getValue('#-log1')).toBeUndefined();
    expect(addBlock.getValue('#addon')).toEqual(['#-log']);

    await client.undo('Main');
    expect(addBlock.getValue('#-log')).toBeUndefined();
    expect(addBlock.getValue('#addon')).toBeUndefined();

    await client.redo('Main');
    expect(addBlock.getValue('#-log')).toBeInstanceOf(Block);
    expect(addBlock.getValue('#addon')).toEqual(['#-log']);
  });

  it('rejects non-addon functions and invalid #addon targets', async () => {
    await expect(client.addBlock('Main.add.#-add', {'#is': 'add'}, true)).rejects.toBe('invalid addon function');
    expect(addBlock.getValue('#-add')).toBeUndefined();
    expect(addBlock.getValue('#addon')).toBeUndefined();

    flow.setValue('addons', ['#-log']);
    addBlock.setBinding('#addon', '##.addons');
    await expect(client.addBlock('Main.add.#-log', {'#is': 'log'}, true)).rejects.toBe('invalid addon');
  });

  it('updates #addon on rename and delete and clears #addon when the last addon is removed', async () => {
    await client.addBlock('Main.add.#-log', {'#is': 'log', '#mode': 'onCall', '~#call': '##.#emit'}, true);
    await client.addBlock('Main.add.#-log', {'#is': 'log', '#mode': 'onCall', '~#call': '##.#emit'}, true);
    expect(addBlock.getValue('#addon')).toEqual(['#-log', '#-log1']);

    renameProperty(addBlock, '#-log', '#-audit');
    expect(addBlock.getValue('#-log')).toBeUndefined();
    expect(addBlock.getValue('#-audit')).toBeInstanceOf(Block);
    expect(addBlock.getValue('#addon')).toEqual(['#-audit', '#-log1']);

    deleteBlock(addBlock, '#-audit');
    expect(addBlock.getValue('#-audit')).toBeUndefined();
    expect(addBlock.getValue('#addon')).toEqual(['#-log1']);

    await client.deleteBlock('Main.add.#-log1');
    expect(addBlock.getValue('#-log1')).toBeUndefined();
    expect(addBlock.getValue('#addon')).toBeUndefined();
  });

  it('enforces EditPolicy on addon creation and deletion', async () => {
    expect(
      checkEditPolicy(
        {denyProps: ['#addon']},
        {cmd: 'addBlock', path: 'Main.add.#-log', data: {'#is': 'log'}, findName: true}
      )
    ).toBe('restricted property');
    expect(
      checkEditPolicy(
        {allowCreateBlock: false},
        {cmd: 'addBlock', path: 'Main.add.#-log', data: {'#is': 'log'}, findName: true}
      )
    ).toBe('restricted block creation');
    expect(checkEditPolicy({denyProps: ['#addon']}, {cmd: 'deleteBlock', path: 'Main.add.#-log'})).toBe(
      'restricted operation'
    );
    expect(
      checkEditPolicy(
        {allowPaths: ['Main.add.#-log'], denyPaths: ['Main.add.#addon']},
        {cmd: 'deleteBlock', path: 'Main.add.#-log'}
      )
    ).toBe('restricted path');
    expect(checkEditPolicy({allowDeleteBlock: false}, {cmd: 'deleteBlock', path: 'Main.add.#-log'})).toBe(
      'restricted block deletion'
    );

    await expect(
      client.withPolicy({denyProps: ['#addon']}).addBlock('Main.add.#-log', {'#is': 'log'}, true)
    ).rejects.toBe('restricted property');
  });
});
