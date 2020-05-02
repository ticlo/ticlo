import {assert} from 'chai';
import shelljs from 'shelljs';
import Fs from 'fs';
import {Flow, Root, decode} from '../../../core';
import {shouldHappen, shouldReject, waitTick} from '../../../core/util/test-util';
import {FileStorage} from '../FileStorage';

describe('FileStorage', function () {
  before(function () {
    shelljs.mkdir('-p', './temp/storageTest');
  });
  it('save and delete', async function () {
    const path = './temp/storageTest/flow1.ticlo';
    let root = new Root();
    await root.setStorage(new FileStorage('./temp/storageTest'));

    let flow = root.addFlow('flow1');
    flow.applyChange();
    let savedData: string;
    await shouldHappen(() => (savedData = Fs.existsSync(path) ? Fs.readFileSync(path, 'utf8') : null));
    assert.equal(savedData, '{\n"#is": ""\n}');

    root.deleteFlow('flow1');
    await shouldHappen(() => !Fs.existsSync(path), 500);

    // overwrite multiple times
    flow = root.addFlow('flow2');
    flow.applyChange();
    flow.setValue('value', 123);
    flow.applyChange();
    root.deleteFlow('flow2');
    flow = root.addFlow('flow2');
    flow.setValue('value', 456);
    flow.applyChange();
    await waitTick(20);
    await shouldHappen(() => (savedData = Fs.readFileSync('./temp/storageTest/flow2.ticlo', 'utf8')));
    assert.deepEqual(decode(savedData), {'#is': '', 'value': 456});

    // overwrite delete after write
    flow = root.addFlow('flow3');
    flow.applyChange();
    root.deleteFlow('flow3');
    flow = root.addFlow('flow3');
    root.deleteFlow('flow3');
    await waitTick(20);
    await shouldHappen(() => !Fs.existsSync('./temp/storageTest/flow3.ticlo'));

    // overwirte delete after delete
    flow = root.addFlow('flow4');
    root.deleteFlow('flow4');
    flow = root.addFlow('flow4');
    root.deleteFlow('flow4');
    await waitTick(40);
    assert.isFalse(Fs.existsSync('./temp/storageTest/flow4.ticlo'));

    root.destroy();
  });
  it('init loader', async function () {
    let flowData = {'#is': '', 'value': 321};
    const path1 = './temp/storageTest/flow5.subflow.ticlo';
    Fs.writeFileSync(path1, JSON.stringify(flowData));

    const path2 = './temp/storageTest/flow5.ticlo';
    Fs.writeFileSync(path2, JSON.stringify(flowData));

    let root = new Root();
    root.setStorage(new FileStorage('./temp/storageTest'));

    assert.equal(root.queryValue('flow5.value'), 321);
    assert.equal(root.queryValue('flow5.subflow.value'), 321);
    assert.deepEqual((root.getValue('flow5') as Flow).save(), flowData);

    Fs.unlinkSync(path2);
    root.destroy();
  });
});
