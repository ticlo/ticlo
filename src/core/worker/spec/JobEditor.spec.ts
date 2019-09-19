import {assert} from "chai";
import {Job, Root} from "../../block/Block";
import {JobEditor} from "../JobEditor";
import {VoidListeners} from "../../block/spec/TestFunction";
import {WorkerFunction} from "../WorkerFunction";
import {Types} from "../../block/Type";
import {PropDesc, PropGroupDesc} from "../../block/Descriptor";

describe("JobEditor", function () {

  it('delete editor after unwatch', function () {
    let job = new Job();
    let editor1 = JobEditor.create(job, '#edit-1', {});
    let editor2 = JobEditor.create(job, '#edit-2');

    assert.isNull(editor2, 'failed to load');
    assert.instanceOf(job.getValue('#edit-2'), JobEditor);

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

    WorkerFunction.registerType(data, {name: 'func1'}, 'JobEditor');

    // editor with map data
    block.setValue('use1', data);
    JobEditor.createFromField(block, '#edit-use1', 'use1');
    assert.deepEqual(block.getValue('#edit-use1').save(), data);

    // editor with registered worker function
    block.setValue('use2', 'JobEditor:func1');
    JobEditor.createFromField(block, '#edit-use2', 'use2');
    assert.deepEqual(block.getValue('#edit-use2').save(), data);

    Types.clear('JobEditor:func1');
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
    }, 'JobEditor');

    block.setValue('#is', 'JobEditor:worker1');

    // set invalid function so it fallbacks to property's default inputs
    block.setValue('use', 'invalidFunction');
    JobEditor.createFromField(block, '#edit-use', 'use');
    assert.deepEqual(block.getValue('#edit-use').save(), expectedData);

    Types.clear('JobEditor:worker1');
  });

  it('createFromFunction', function () {
    let job = new Job();
    let data = {
      '#is': '',
      'add': {
        '#is': 'subtract'
      }
    };

    WorkerFunction.registerType(data, {name: 'worker2'}, 'JobEditor');

    JobEditor.createFromFunction(job, '#edit-func', 'JobEditor:worker2');
    assert.deepEqual(job.getValue('#edit-func').save(), data);

    Types.clear('JobEditor:worker2');
  });

  it('applyChange', function () {
    let job = new Job();
    let editor = JobEditor.create(job, '#edit-v2', {});
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

    WorkerFunction.registerType({'#is': ''}, {name: 'worker3', properties: []}, 'JobEditor');

    let editor = JobEditor.createFromFunction(job, '#edit-func', 'JobEditor:worker3');
    editor.createBlock('#input')._load(expectedData["#input"]);
    editor.createBlock('#output')._load(expectedData["#output"]);
    editor.setValue('@f-icon', 'fas:plus');

    editor.applyChange();

    assert.deepEqual(Types.getWorkerData('JobEditor:worker3'), expectedData);

    let desc = Types.getDesc('JobEditor:worker3')[0];
    assert.equal(desc.icon, 'fas:plus');
    assert.deepEqual(desc.properties, expectedDescProperties);

    Types.clear('JobEditor:worker3');
  });
});
