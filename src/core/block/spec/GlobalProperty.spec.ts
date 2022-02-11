import {assert} from 'chai';
import {Block} from '../Block';
import {Flow, Root} from '../Flow';
import {DataMap} from '../../util/DataTypes';
import {WorkerFunction} from '../../worker/WorkerFunction';

describe('GlobalProperty', function () {
  it('global from nested flow', function () {
    let globalBlock: Block = Root.instance.getValue('#global');
    assert.instanceOf(globalBlock, Block);

    let flow = new Flow();
    let aBlock = flow.createBlock('a');

    aBlock.setValue('#is', 'GlobalProperty:class1');

    let flowData: DataMap = {
      '#is': '',
      '~v': '^top.v',
    };
    WorkerFunction.registerType(flowData, {name: 'class1'}, 'GlobalProperty');

    Root.run();

    let impl: Flow = aBlock.getValue('#flow') as Flow;
    assert.instanceOf(impl, Flow, 'get #flow of nested flow');
    // v not ready yet
    assert.isUndefined(impl.getValue('v'));

    let top = globalBlock.createBlock('^top');
    top.setValue('v', 123);
    assert.equal(impl.getValue('v'), 123);

    // overwrite the global block in the local flow
    let topOverwrite = flow.createBlock('^top');
    assert.isUndefined(impl.getValue('v'));

    topOverwrite.setValue('v', 456);
    assert.equal(impl.getValue('v'), 456);

    // clear the overwrite, restore the global link
    flow.deleteValue('^top');
    assert.equal(impl.getValue('v'), 123);

    globalBlock._liveUpdate({}); // clear global object
    assert.equal(impl.getValue('v'), undefined);

    // global property is in use
    assert.isTrue(flow._props.has('^top'));

    flow.deleteValue('a');
    // global property is no longer in use
    assert.isFalse(flow._props.has('^top'));
  });
});
