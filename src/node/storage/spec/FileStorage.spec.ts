import {assert} from 'chai';
import shelljs from 'shelljs';
import Fs from 'fs';
import {Job, Root, decode} from '../../../core';
import {shouldHappen, shouldReject, waitTick} from '../../../core/util/test-util';
import {FileStorage} from '../FileStorage';

describe('FileStorage', function() {
  before(function() {
    shelljs.mkdir('-p', './temp/storageTest');
  });
  it('save and delete', async function() {
    const path = './temp/storageTest/job1.ticlo';
    let root = new Root();
    await root.setStorage(new FileStorage('./temp/storageTest'));

    let job = root.addJob('job1');
    job.applyChange();
    let savedData: string;
    await shouldHappen(() => (savedData = Fs.readFileSync(path, 'utf8')));
    assert.equal(savedData, '{\n"#is": ""\n}');

    root.deleteJob('job1');
    await shouldHappen(() => !Fs.existsSync(path));

    // overwrite multiple times
    job = root.addJob('job2');
    job.applyChange();
    job.setValue('value', 123);
    job.applyChange();
    root.deleteJob('job2');
    job = root.addJob('job2');
    job.setValue('value', 456);
    job.applyChange();
    await waitTick(20);
    await shouldHappen(() => (savedData = Fs.readFileSync('./temp/storageTest/job2.ticlo', 'utf8')));
    assert.deepEqual(decode(savedData), {'#is': '', 'value': 456});

    // overwrite delete after write
    job = root.addJob('job3');
    job.applyChange();
    root.deleteJob('job3');
    job = root.addJob('job3');
    root.deleteJob('job3');
    await waitTick(20);
    await shouldHappen(() => !Fs.existsSync('./temp/storageTest/job3.ticlo'));

    // overwirte delete after delete
    job = root.addJob('job4');
    root.deleteJob('job4');
    job = root.addJob('job4');
    root.deleteJob('job4');
    await waitTick(40);
    assert.isFalse(Fs.existsSync('./temp/storageTest/job4.ticlo'));

    root.destroy();
  });
  it('init loader', async function() {
    let jobData = {'#is': '', 'value': 321};
    const path1 = './temp/storageTest/job5.subjob.ticlo';
    Fs.writeFileSync(path1, JSON.stringify(jobData));

    const path2 = './temp/storageTest/job5.ticlo';
    Fs.writeFileSync(path2, JSON.stringify(jobData));

    let root = new Root();
    root.setStorage(new FileStorage('./temp/storageTest'));

    assert.equal(root.queryValue('job5.value'), 321);
    assert.equal(root.queryValue('job5.subjob.value'), 321);
    assert.deepEqual((root.getValue('job5') as Job).save(), jobData);

    Fs.unlinkSync(path2);
    root.destroy();
  });
});
