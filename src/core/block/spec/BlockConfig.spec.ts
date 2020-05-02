import {assert} from 'chai';
import {TestFunctionRunner} from './TestFunction';
import {Flow, Root} from '../Flow';

describe('BlockConfig', function () {
  it('readonly control', function () {
    let flow = new Flow();

    let block = flow.createBlock('obj');

    assert.equal(block.getValue('##'), flow, 'get ##');
    assert.equal(block.getValue('###'), flow, 'get ###');

    block.setValue('##', 1);
    assert.equal(block.getValue('##'), flow, 'readonly property setValue');

    block.updateValue('##', 1);
    assert.equal(block.getValue('##'), flow, 'readonly property updateValue');

    block.setValue('a', 1);
    block.setBinding('##', 'a');
    assert.equal(block.getValue('##'), flow, 'readonly property setBinding');
  });

  it('#is', function () {
    let flow = new Flow();

    let block = flow.createBlock('obj');

    assert.equal(block.getValue('#is'), '', '#is "" by default');

    block.setValue('@is', 'add');
    block.setBinding('#is', '@is');
    assert.equal(block.getValue('#is'), 'add', '#is with binding');
    assert.deepEqual(flow.save(), {'#is': '', 'obj': {'@is': 'add', '~#is': '@is'}}, 'save #is');

    block.setBinding('#is', null);
    assert.equal(block.getValue('#is'), '', '#is revert back to "" after unbind');
    assert.deepEqual(flow.save(), {'#is': '', 'obj': {'@is': 'add', '#is': ''}}, 'save #is');
  });
});
