import {assert} from "chai";
import {Job, Root} from "../../block/Block";
import {JobEditor} from "../JobEditor";
import {VoidListeners} from "../../block/spec/TestFunction";
import {WorkerFunction} from "../WorkerFunction";
import {Types} from "../../block/Type";

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
        '@b-more': [{'name': 'a', 'type': 'number'}],
        '@b-p': ['a']
      },
      '#is': '',
      '#output': {
        '#is': '',
        '@b-more': [{'name': 'b', 'type': 'number'}],
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

    WorkerFunction.registerType(data, {name: 'func2'}, 'JobEditor');

    JobEditor.createFromFunction(job, '#edit-func', 'JobEditor:func2');
    assert.deepEqual(job.getValue('#edit-func').save(), data);

    Types.clear('JobEditor:func2');
  });

});
