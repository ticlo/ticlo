import {assert} from 'chai';
import {Flow} from '../Flow';
import {BlockIO} from '../BlockProperty';

describe('Block Child Watch', function () {
  it('basic', function () {
    let flow = new Flow();

    let watchLog: any[] = [];
    let watch = {
      onChildChange(property: BlockIO, saved: boolean) {
        watchLog.push([property._name, property._value != null, Boolean(saved)]);
      },
    };
    flow.watch(watch);

    flow.createBlock('a');
    assert.deepEqual(watchLog, [['a', true, true]], 'new block');
    watchLog = [];

    flow.createOutputBlock('a');
    assert.deepEqual(watchLog, [['a', true, false]], 'replace with temp block');
    watchLog = [];

    flow.createBlock('a');
    assert.deepEqual(watchLog, [['a', true, true]], 'replace with normal block');
    watchLog = [];

    flow.setValue('a', null);
    assert.deepEqual(watchLog, [['a', false, true]], 'remove block');
    watchLog = [];

    flow.createOutputBlock('a');
    assert.deepEqual(watchLog, [['a', true, false]], 'new temp block');
    watchLog = [];

    flow.setBinding('a', 'b');
    assert.deepEqual(watchLog, [['a', false, false]], 'remove block with binding');
    watchLog = [];
  });
});
