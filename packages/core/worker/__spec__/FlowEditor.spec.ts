import {expect} from 'vitest';
import {Flow} from '../../block/Flow.js';
import {FlowEditor} from '../FlowEditor.js';
import {VoidListeners} from '../../block/__spec__/TestFunction.js';
import {WorkerFunctionGen} from '../WorkerFunctionGen.js';
import {globalFunctions} from '../../block/Functions.js';
import type {PropDesc, PropGroupDesc} from '../../block/Descriptor.js';
import type {DataMap} from '../../util/DataTypes.js';
import {SharedBlock} from '../../block/SharedBlock.js';

describe('FlowEditor', function () {
  it('delete editor after unwatch', function () {
    const flow = new Flow();
    const editor1 = FlowEditor.create(flow, '#edit-1', {});
    const editor2 = FlowEditor.create(flow, '#edit-2');

    expect(editor2).toBeNull();
    expect(flow.getValue('#edit-2')).toBeInstanceOf(FlowEditor);

    editor1.watch(VoidListeners);
    expect(flow.getValue('#edit-1')).toBe(editor1);

    // value deleted after unwatch
    editor1.unwatch(VoidListeners);
    expect(flow.getValue('#edit-1')).not.toBeDefined();
  });

  it('createFromField', function () {
    const flow = new Flow();
    const block = flow.createBlock('a');
    const data = {
      '#is': '',
      'add': {
        '#is': 'add',
      },
    };

    WorkerFunctionGen.registerType(data, {name: 'func1'}, 'FlowEditor');

    // editor with map data
    block.setValue('use1', data);
    FlowEditor.createFromField(block, '#edit-use1', 'use1');
    expect((block.getValue('#edit-use1') as Flow).save()).toEqual(data);

    // editor with registered worker function
    block.setValue('use2', 'FlowEditor:func1');
    FlowEditor.createFromField(block, '#edit-use2', 'use2');
    expect((block.getValue('#edit-use2') as Flow).save()).toEqual(data);

    globalFunctions.clear('FlowEditor:func1');
  });

  it('createFromFunction', function () {
    const flow = new Flow();
    const data = {
      '#is': '',
      'add': {
        '#is': 'subtract',
      },
    };

    WorkerFunctionGen.registerType(data, {name: 'worker2'}, 'FlowEditor');

    FlowEditor.createFromFunction(flow, '#edit-func', 'FlowEditor:worker2', null);
    expect((flow.getValue('#edit-func') as Flow).save()).toEqual(data);

    FlowEditor.createFromFunction(flow, '#edit-func', 'FlowEditor:worker2-2', data);
    expect((flow.getValue('#edit-func') as Flow).save()).toEqual(data);

    globalFunctions.clear('FlowEditor:worker2');
  });

  it('applyChange', function () {
    const flow = new Flow();
    const editor = FlowEditor.create(flow, '#edit-v2', {}, null, false, (data: DataMap) => {
      flow.setValue('v2', data);
      return true;
    });
    editor.applyChange();
    expect(flow.getValue('v2')).toEqual({'#is': ''});
  });

  it('applyChange function', function () {
    const flow = new Flow();

    const expectedData = {
      '#inputs': {
        '#is': '',
        '#custom': [
          {
            name: 'g',
            type: 'group',
            defaultLen: 2,
            properties: [{name: 'a', type: 'number'}],
          },
          {name: 'a', type: 'number'},
        ],
        '@b-p': ['a'],
      },
      '#is': '',
      '#outputs': {
        '#is': '',
        '#custom': [
          {
            name: 'g',
            type: 'group',
            defaultLen: 2,
            properties: [{name: 'b', type: 'number'}],
          },
          {name: 'b', type: 'number'},
        ],
        '@b-p': ['b'],
      },
      '#desc': {icon: 'fas:plus'},
    };
    const expectedDescProperties: (PropDesc | PropGroupDesc)[] = [
      {
        name: 'g',
        type: 'group',
        defaultLen: 2,
        properties: [
          {name: 'a', type: 'number'},
          {name: 'b', type: 'number', readonly: true},
        ],
      },
      {name: 'a', type: 'number'},
      {name: 'b', type: 'number', readonly: true},
    ];

    WorkerFunctionGen.registerType({'#is': ''}, {name: 'worker3', properties: []}, 'FlowEditor');

    const editor = FlowEditor.createFromFunction(flow, '#edit-func', 'FlowEditor:worker3', null);
    editor.createBlock('#inputs')._load(expectedData['#inputs']);
    editor.createBlock('#outputs')._load(expectedData['#outputs']);
    editor.setValue('#desc', expectedData['#desc']);
    WorkerFunctionGen.applyChangeToFunc(editor, 'FlowEditor:worker3');

    expect(globalFunctions.getWorkerData('FlowEditor:worker3')).toEqual(expectedData);

    const desc = globalFunctions.getDescToSend('FlowEditor:worker3')[0];
    expect(desc.icon).toBe('fas:plus');
    expect(desc.properties).toEqual(expectedDescProperties);

    globalFunctions.clear('FlowEditor:worker3');
    flow.destroy();
  });

  it('shared block', function () {
    const flow = new Flow();

    const editor = FlowEditor.createFromFunction(flow, '#edit-func', 'FlowEditor:worker4', {
      '#is': '',
      '#shared': {'#is': ''},
    });

    const block: SharedBlock = editor.getValue('#shared') as SharedBlock;
    expect(block).toBeInstanceOf(SharedBlock);
    expect(block._prop).toBe(editor.getProperty('#shared'));

    flow.destroy();
  });
});
