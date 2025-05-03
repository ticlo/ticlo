import {expect} from 'vitest';
import {Block} from '../Block';
import {Flow, Root} from '../Flow';
import {DataMap} from '../../util/DataTypes';
import {WorkerFunctionGen} from '../../worker/WorkerFunctionGen';

describe('ContextProperty', function () {
  it('global from nested flow', function () {
    let globalBlock: Block = Root.instance.getValue('#global') as Block;
    expect(globalBlock).toBeInstanceOf(Block);

    let flow = new Flow();
    let aBlock = flow.createBlock('a');

    aBlock.setValue('#is', 'ContextProperty:class1');

    let flowData: DataMap = {
      '#is': '',
      '~v': '^top.v',
    };
    WorkerFunctionGen.registerType(flowData, {name: 'class1'}, 'ContextProperty');

    Root.run();

    let impl: Flow = aBlock.getValue('#flow') as Flow;
    expect(impl).toBeInstanceOf(Flow);
    // v not ready yet
    expect(impl.getValue('v')).not.toBeDefined();

    let top = globalBlock.createBlock('^top');
    top.setValue('v', 123);
    expect(impl.getValue('v')).toBe(123);

    // overwrite the global block in the local flow
    let topOverwrite = flow.createBlock('^top');
    expect(impl.getValue('v')).not.toBeDefined();

    topOverwrite.setValue('v', 456);
    expect(impl.getValue('v')).toBe(456);

    // clear the overwrite, restore the global link
    flow.deleteValue('^top');
    expect(impl.getValue('v')).toBe(123);

    globalBlock._liveUpdate({}); // clear global object
    expect(impl.getValue('v')).toBe(undefined);

    // context property is in use
    expect(flow._props.has('^top')).toBe(true);

    flow.deleteValue('a');
    // context property is no longer in use
    expect(flow._props.has('^top')).toBe(false);
  });
});
