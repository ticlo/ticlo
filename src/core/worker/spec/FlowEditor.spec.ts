import {assert} from 'chai';
import {Flow, Root} from '../../block/Flow';
import {FlowEditor} from '../FlowEditor';
import {VoidListeners} from '../../block/spec/TestFunction';
import {WorkerFunction} from '../WorkerFunction';
import {Functions} from '../../block/Functions';
import {PropDesc, PropGroupDesc} from '../../block/Descriptor';
import {DataMap} from '../../util/DataTypes';
import {SharedBlock} from '../../block/SharedBlock';

describe('FlowEditor', function () {
  it('delete editor after unwatch', function () {
    let flow = new Flow();
    let editor1 = FlowEditor.create(flow, '#edit-1', {});
    let editor2 = FlowEditor.create(flow, '#edit-2');

    assert.isNull(editor2, 'failed to load');
    assert.instanceOf(flow.getValue('#edit-2'), FlowEditor);

    editor1.watch(VoidListeners);
    assert.equal(flow.getValue('#edit-1'), editor1);

    // value deleted after unwatch
    editor1.unwatch(VoidListeners);
    assert.isUndefined(flow.getValue('#edit-1'));
  });

  it('createFromField', function () {
    let flow = new Flow();
    let block = flow.createBlock('a');
    let data = {
      '#is': '',
      'add': {
        '#is': 'add',
      },
    };

    WorkerFunction.registerType(data, {name: 'func1'}, 'FlowEditor');

    // editor with map data
    block.setValue('use1', data);
    FlowEditor.createFromField(block, '#edit-use1', 'use1');
    assert.deepEqual(block.getValue('#edit-use1').save(), data);

    // editor with registered worker function
    block.setValue('use2', 'FlowEditor:func1');
    FlowEditor.createFromField(block, '#edit-use2', 'use2');
    assert.deepEqual(block.getValue('#edit-use2').save(), data);

    Functions.clear('FlowEditor:func1');
  });

  it('createFromFunction', function () {
    let flow = new Flow();
    let data = {
      '#is': '',
      'add': {
        '#is': 'subtract',
      },
    };

    WorkerFunction.registerType(data, {name: 'worker2'}, 'FlowEditor');

    FlowEditor.createFromFunction(flow, '#edit-func', 'FlowEditor:worker2', null);
    assert.deepEqual(flow.getValue('#edit-func').save(), data);

    FlowEditor.createFromFunction(flow, '#edit-func', 'FlowEditor:worker2-2', data);
    assert.deepEqual(flow.getValue('#edit-func').save(), data);

    Functions.clear('FlowEditor:worker2');
  });

  it('applyChange', function () {
    let flow = new Flow();
    let editor = FlowEditor.create(flow, '#edit-v2', {}, null, false, (data: DataMap) => {
      flow.setValue('v2', data);
      return true;
    });
    editor.applyChange();
    assert.deepEqual(flow.getValue('v2'), {'#is': ''});
  });

  it('applyChange function', function () {
    let flow = new Flow();

    let expectedData = {
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
    let expectedDescProperties: (PropDesc | PropGroupDesc)[] = [
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

    WorkerFunction.registerType({'#is': ''}, {name: 'worker3', properties: []}, 'FlowEditor');

    let editor = FlowEditor.createFromFunction(flow, '#edit-func', 'FlowEditor:worker3', null);
    editor.createBlock('#inputs')._load(expectedData['#inputs']);
    editor.createBlock('#outputs')._load(expectedData['#outputs']);
    editor.setValue('#desc', expectedData['#desc']);
    WorkerFunction.applyChangeToFunc(editor, 'FlowEditor:worker3');

    assert.deepEqual(Functions.getWorkerData('FlowEditor:worker3'), expectedData);

    let desc = Functions.getDescToSend('FlowEditor:worker3')[0];
    assert.equal(desc.icon, 'fas:plus');
    assert.deepEqual(desc.properties, expectedDescProperties);

    Functions.clear('FlowEditor:worker3');
    flow.destroy();
  });

  it('shared block', function () {
    let flow = new Flow();

    let editor = FlowEditor.createFromFunction(flow, '#edit-func', 'FlowEditor:worker4', {
      '#is': '',
      '#shared': {'#is': ''},
    });

    let block: SharedBlock = editor.getValue('#shared');
    assert.instanceOf(block, SharedBlock);
    assert.equal(block._prop, editor.getProperty('#shared'));

    flow.destroy();
  });
});
