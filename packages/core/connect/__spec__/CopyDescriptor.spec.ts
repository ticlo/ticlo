import {Flow, Root} from '../../block/Flow.ts';
import {type ClientConnection} from '../ClientConnection.ts';
import {makeLocalConnection} from '../LocalConnection.ts';
import {type PropDesc, type PropGroupDesc} from '../../block/Descriptor.ts';
import {globalFunctions} from '../../block/FunctionLib.ts';
import {WorkerFunctionGen} from '../../worker/WorkerFunctionGen.ts';
import {checkEditPolicy} from '../../policy/EditPolicy.ts';
import '../../functions/math/Arithmetic.ts';

describe('copy custom property descriptor', () => {
  let root: Root;
  let flow: Flow;
  let client: ClientConnection;
  const original: PropDesc = {name: 'value', type: 'any'};
  const source: PropDesc = {name: 'source', type: 'number', min: 1, max: 10, step: 0.5};

  beforeEach(() => {
    root = new Root();
    flow = root.addFlow(
      'Main',
      {'#custom': [original, source], '~value': 'source', 'source': 3},
      {applyChange: (flow) => flow.save()}
    );
    [, client] = makeLocalConnection(root, false);
  });

  afterEach(() => {
    client.destroy();
    root.destroy();
  });

  it('prefers the binding source and supports undo and redo', async () => {
    await client.addBlock('Main.target', {'#is': 'add', '~0': '##.value'});
    flow.startHistory();
    await client.copyCustomPropDesc('Main', 'value');
    expect(flow.getValue('#custom')).toEqual([{...source, name: 'value'}, source]);
    expect(flow.getProperty('value')._bindingPath).toBe('source');
    expect(flow.getValue('value')).toBe(3);
    await client.undo('Main');
    expect(flow.getValue('#custom')).toEqual([original, source]);
    await client.redo('Main');
    expect(flow.getValue('#custom')).toEqual([{...source, name: 'value'}, source]);
  });

  it('copies from the sole binding target and ignores subscriptions', async () => {
    flow.setValue('value', 3);
    await client.addBlock('Main.target', {'#is': 'add', '~0': '##.value'});
    client.subscribe('Main.value', {onUpdate() {}});
    await client.copyCustomPropDesc('Main', 'value');
    expect((flow.getValue('#custom') as PropDesc[])[0]).toMatchObject({name: 'value', type: 'number'});
    expect(flow.getValue('value')).toBe(3);
  });

  it('leaves the descriptor unchanged when there are multiple binding targets', async () => {
    flow.setValue('value', 3);
    await client.addBlock('Main.target', {'#is': 'add', '~0': '##.value', '~1': '##.value'});
    await client.copyCustomPropDesc('Main', 'value');
    expect(flow.getValue('#custom')).toEqual([original, source]);
  });

  it('does not use a binding target when its binding source has no descriptor', async () => {
    await client.addBlock('Main.target', {'#is': 'add', '~0': '##.value'});
    flow.setBinding('value', 'untyped');
    await client.copyCustomPropDesc('Main', 'value');
    expect(flow.getValue('#custom')).toEqual([original, source]);
  });

  it('does nothing without a connected property', async () => {
    flow.setValue('value', 3);
    await client.copyCustomPropDesc('Main', 'value');
    expect(flow.getValue('#custom')).toEqual([original, source]);
    flow.setBinding('value', 'object.field');
    flow.setValue('object', {field: 3});
    await client.copyCustomPropDesc('Main', 'value');
    expect(flow.getValue('#custom')).toEqual([original, source]);
  });

  it('updates the shared group child descriptor and leaves the group header unchanged', async () => {
    const group: PropGroupDesc = {
      name: 'items',
      type: 'group',
      defaultLen: 3,
      properties: [
        {name: 'item', type: 'any'},
        {name: 'label', type: 'string'},
      ],
    };
    flow.setValue('#custom', [group, source]);
    flow.setBinding('item1', 'source');
    flow.setBinding('items[]', 'source');
    await client.copyCustomPropDesc('Main', 'items[]', 'items');
    expect(flow.getValue('#custom')).toEqual([group, source]);
    await client.copyCustomPropDesc('Main', 'item1', 'items');
    expect(flow.getValue('#custom')).toEqual([
      {...group, properties: [{...source, name: 'item'}, group.properties[1]]},
      source,
    ]);
    expect(flow.getProperty('item1')._bindingPath).toBe('source');
    expect(flow.save()['#custom']).toEqual(flow.getValue('#custom'));
  });

  it('supports a group child with an empty base name', async () => {
    flow.setValue('#custom', [{name: '', type: 'group', defaultLen: 2, properties: [{name: '', type: 'any'}]}, source]);
    flow.setBinding('1', 'source');
    await client.copyCustomPropDesc('Main', '1', '');
    expect((flow.getValue('#custom') as PropGroupDesc[])[0].properties).toEqual([{...source, name: ''}]);
  });

  it('resolves flow-local function and inherited optional descriptors', async () => {
    WorkerFunctionGen.registerType(
      {'#is': '', '#inputs': {'#is': '', '#custom': [source]}, '#outputs': {'#is': ''}},
      {id: ':local', name: 'local'},
      undefined,
      flow.getFuncLib()
    );
    await client.addBlock('Main.local', {'#is': ':local'});
    flow.setBinding('value', 'local.source');
    await client.copyCustomPropDesc('Main', 'value');
    expect((flow.getValue('#custom') as PropDesc[])[0]).toEqual({...source, name: 'value'});

    globalFunctions.addFactory(null, {name: 'copy-desc-base', optional: {option: {name: 'option', type: 'color'}}});
    globalFunctions.addFactory(null, {name: 'copy-desc-child', base: 'copy-desc-base'});
    try {
      await client.addBlock('Main.optional', {'#is': 'copy-desc-child', '#optional': ['option']});
      flow.setBinding('value', 'optional.option');
      await client.copyCustomPropDesc('Main', 'value');
      expect((flow.getValue('#custom') as PropDesc[])[0]).toEqual({name: 'value', type: 'color'});
    } finally {
      globalFunctions.delete('copy-desc-child');
      globalFunctions.delete('copy-desc-base');
    }
  });

  it('clones nested descriptor data and cannot replace built-in properties', async () => {
    const table: PropDesc = {name: 'table', type: 'table', columns: [{key: 'x', type: 'string'}]};
    flow.setValue('#custom', [original, table]);
    flow.setBinding('value', 'table');
    await client.copyCustomPropDesc('Main', 'value');
    const copied = (flow.getValue('#custom') as PropDesc[])[0];
    expect(copied).toEqual({...table, name: 'value'});
    expect(copied.columns).not.toBe(table.columns);
    await client.addBlock('Main.add', {'#is': 'add', '~0': '##.table'});
    await client.copyCustomPropDesc('Main.add', '0');
    expect(flow.queryValue('add.#custom')).toBeUndefined();
  });

  it('applies schema edit restrictions and readonly server policy', async () => {
    expect(checkEditPolicy({denyProps: ['#custom']}, {cmd: 'copyCustomPropDesc', path: 'Main', name: 'value'})).toBe(
      'restricted operation'
    );
    const [, readonlyClient] = makeLocalConnection(root, false, {readonly: true});
    try {
      await expect(readonlyClient.copyCustomPropDesc('Main', 'value')).rejects.toBe('readonly');
      expect(flow.getValue('#custom')).toEqual([original, source]);
    } finally {
      readonlyClient.destroy();
    }
  });
});
