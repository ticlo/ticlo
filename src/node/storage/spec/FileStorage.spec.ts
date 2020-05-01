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
    const path = './temp/storageTest/job1.ticlo';
    let root = new Root();
    await root.setStorage(new FileStorage('./temp/storageTest'));

    let job = root.addFlow('job1');
    job.applyChange();
    let savedData: string;
    await shouldHappen(() => (savedData = Fs.existsSync(path) ? Fs.readFileSync(path, 'utf8') : null));
    assert.equal(savedData, '{\n"#is": ""\n}');

    root.deleteFlow('job1');
    await shouldHappen(() => !Fs.existsSync(path), 500);

    // overwrite multiple times
    job = root.addFlow('job2');
    job.applyChange();
    job.setValue('value', 123);
    job.applyChange();
    root.deleteFlow('job2');
    job = root.addFlow('job2');
    job.setValue('value', 456);
    job.applyChange();
    await waitTick(20);
    await shouldHappen(() => (savedData = Fs.readFileSync('./temp/storageTest/job2.ticlo', 'utf8')));
    assert.deepEqual(decode(savedData), {'#is': '', 'value': 456});

    // overwrite delete after write
    job = root.addFlow('job3');
    job.applyChange();
    root.deleteFlow('job3');
    job = root.addFlow('job3');
    root.deleteFlow('job3');
    await waitTick(20);
    await shouldHappen(() => !Fs.existsSync('./temp/storageTest/job3.ticlo'));

    // overwirte delete after delete
    job = root.addFlow('job4');
    root.deleteFlow('job4');
    job = root.addFlow('job4');
    root.deleteFlow('job4');
    await waitTick(40);
    assert.isFalse(Fs.existsSync('./temp/storageTest/job4.ticlo'));

    root.destroy();
  });
  it('init loader', async function () {
    let jobData = {'#is': '', 'value': 321};
    const path1 = './temp/storageTest/job5.subjob.ticlo';
    Fs.writeFileSync(path1, JSON.stringify(jobData));

    const path2 = './temp/storageTest/job5.ticlo';
    Fs.writeFileSync(path2, JSON.stringify(jobData));

    let root = new Root();
    root.setStorage(new FileStorage('./temp/storageTest'));

    assert.equal(root.queryValue('job5.value'), 321);
    assert.equal(root.queryValue('job5.subjob.value'), 321);
    assert.deepEqual((root.getValue('job5') as Flow).save(), jobData);

    Fs.unlinkSync(path2);
    root.destroy();
  });
});
