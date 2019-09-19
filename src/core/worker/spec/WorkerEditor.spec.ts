import {assert} from "chai";
import {Job, Root} from "../../block/Block";
import {WorkerEditor} from "../WorkerEditor";
import {VoidListeners} from "../../block/spec/TestFunction";
import {WorkerFunction} from "../WorkerFunction";
import {Types} from "../../block/Type";
import {PropDesc, PropGroupDesc} from "../../block/Descriptor";

describe("WorkerEditor", function () {

  it('delete editor after unwatch', function () {
    let job = new Job();
    let editor1 = WorkerEditor.create(job, '#edit-1', {});
    let editor2 = WorkerEditor.create(job, '#edit-2');

    assert.isNull(editor2, 'failed to load');
    assert.instanceOf(job.getValue('#edit-2'), WorkerEditor);

    editor1.watch(VoidListeners);
    assert.equal(job.getValue('#edit-1'), editor1);

    // value deleted after unwatch
    editor1.unwatch(VoidListeners);
    assert.isUndefined(job.getValue('#edit-1'));
  });

  it('createFromField', function () {
    let job = new Job();
    let block = job.createBlock('a');
    let data = {
      '#is': '',
      'add': {
        '#is': 'add'
      }
    };

    WorkerFunction.registerType(data, {name: 'func1'}, 'WorkerEditor');

    // editor with map data
    block.setValue('use1', data);
    WorkerEditor.createFromField(block, '#edit-use1', 'use1');
    assert.deepEqual(block.getValue('#edit-use1').save(), data);

    // editor with registered worker function
    block.setValue('use2', 'WorkerEditor:func1');
    WorkerEditor.createFromField(block, '#edit-use2', 'use2');
    assert.deepEqual(block.getValue('#edit-use2').save(), data);

    Types.clear('WorkerEditor:func1');
  });

  it('createFromField desc', function () {
    let job = new Job();
    let block = job.createBlock('a');
    let expectedData = {
      '#input': {
        '#is': '',
        '#more': [{'name': 'a', 'type': 'number'}],
        '@b-p': ['a']
      },
      '#is': '',
      '#output': {
        '#is': '',
        '#more': [{'name': 'b', 'type': 'number'}],
        '@b-p': ['b']
      }
    };

    WorkerFunction.registerType({'#is': ''}, {
      name: 'worker1',
      properties: [{
        name: 'use', type: 'worker', inputs: [
          {name: 'a', type: 'number'}
        ],
        outputs: [
          {name: 'b', type: 'number'}
        ]
      }]
    }, 'WorkerEditor');

    block.setValue('#is', 'WorkerEditor:worker1');

    // set invalid function so it fallbacks to property's default inputs
    block.setValue('use', 'invalidFunction');
    WorkerEditor.createFromField(block, '#edit-use', 'use');
    assert.deepEqual(block.getValue('#edit-use').save(), expectedData);

    Types.clear('WorkerEditor:worker1');
  });

  it('createFromFunction', function () {
    let job = new Job();
    let data = {
      '#is': '',
      'add': {
        '#is': 'subtract'
      }
    };

    WorkerFunction.registerType(data, {name: 'worker2'}, 'WorkerEditor');

    WorkerEditor.createFromFunction(job, '#edit-func', 'WorkerEditor:worker2');
    assert.deepEqual(job.getValue('#edit-func').save(), data);

    Types.clear('WorkerEditor:worker2');
  });

  it('applyChange', function () {
    let job = new Job();
    let editor = WorkerEditor.create(job, '#edit-v2', {});
    editor.applyChange();
    assert.deepEqual(job.getValue('v2'), {'#is': ''});
  });

  it('applyChange function', function () {
    let job = new Job();

    let expectedData = {
      '#input': {
        '#is': '',
        '#more': [
          {
            'name': 'g', 'type': 'group', 'defaultLen': 2, 'properties': [
              {'name': 'a', 'type': 'number'}
            ]
          },
          {'name': 'a', 'type': 'number'}
        ],
        '@b-p': ['a']
      },
      '#is': '',
      '#output': {
        '#is': '',
        '#more': [
          {
            'name': 'g', 'type': 'group', 'defaultLen': 2, 'properties': [
              {'name': 'b', 'type': 'number'}
            ]
          },
          {'name': 'b', 'type': 'number'}
        ],
        '@b-p': ['b']
      },
      '@f-icon': 'fas:plus'
    };
    let expectedDescProperties: (PropDesc | PropGroupDesc)[] = [
      {
        'name': 'g', 'type': 'group', 'defaultLen': 2, 'properties': [
          {'name': 'a', 'type': 'number'},
          {'name': 'b', 'type': 'number', 'readonly': true}
        ]
      },
      {'name': 'a', 'type': 'number'},
      {'name': 'b', 'type': 'number', 'readonly': true}
    ];

    WorkerFunction.registerType({'#is': ''}, {name: 'worker3', properties: []}, 'WorkerEditor');

    let editor = WorkerEditor.createFromFunction(job, '#edit-func', 'WorkerEditor:worker3');
    editor.createBlock('#input')._load(expectedData["#input"]);
    editor.createBlock('#output')._load(expectedData["#output"]);
    editor.setValue('@f-icon', 'fas:plus');

    editor.applyChange();

    assert.deepEqual(Types.getWorkerData('WorkerEditor:worker3'), expectedData);

    let desc = Types.getDesc('WorkerEditor:worker3')[0];
    assert.equal(desc.icon, 'fas:plus');
    assert.deepEqual(desc.properties, expectedDescProperties);

    Types.clear('WorkerEditor:worker3');
  });
});
