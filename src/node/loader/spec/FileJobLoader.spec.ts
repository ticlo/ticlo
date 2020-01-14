import {assert} from 'chai';
import shelljs from 'shelljs';
import Fs from 'fs';
import {Job, Root, decode} from '../../../core';
import {shouldHappen, shouldReject, waitTick} from '../../../core/util/test-util';
import {FileJobLoader} from '../FileJobLoader';

describe('FileJobLoader', function() {
  before(function() {
    shelljs.mkdir('-p', './temp/jobLoaderTest');
  });
  it('save and delete', async function() {
    const path = './temp/jobLoaderTest/job1.ticlo';
    let root = new Root();
    root.setLoader(new FileJobLoader('./temp/jobLoaderTest'));

    let job = root.addJob('job1');
    job.applyChange();
    await waitTick(20);
    let savedData = Fs.readFileSync(path, 'utf8');
    assert.equal(savedData, '{\n"#is": ""\n}');

    root.deleteJob('job1');
    await waitTick(20);
    assert.isFalse(Fs.existsSync(path));

    // overwrite multiple times
    job = root.addJob('job2');
    job.applyChange();
    job.setValue('value', 123);
    job.applyChange();
    root.deleteJob('job2');
    job = root.addJob('job2');
    job.setValue('value', 456);
    job.applyChange();
    await waitTick(40);
    savedData = Fs.readFileSync('./temp/jobLoaderTest/job2.ticlo', 'utf8');
    assert.deepEqual(decode(savedData), {'#is': '', 'value': 456});

    // overwrite delete after write
    job = root.addJob('job3');
    job.applyChange();
    root.deleteJob('job3');
    job = root.addJob('job3');
    root.deleteJob('job3');
    await waitTick(40);
    assert.isFalse(Fs.existsSync('./temp/jobLoaderTest/job3.ticlo'));

    // overwirte delete after delete
    job = root.addJob('job4');
    root.deleteJob('job4');
    job = root.addJob('job4');
    root.deleteJob('job4');
    await waitTick(40);
    assert.isFalse(Fs.existsSync('./temp/jobLoaderTest/job4.ticlo'));

    root.destroy();
  });
  it('init loader', async function() {
    let jobData = {'#is': '', 'value': 321};
    const path1 = './temp/jobLoaderTest/job5.subjob.ticlo';
    Fs.writeFileSync(path1, JSON.stringify(jobData));

    const path2 = './temp/jobLoaderTest/job5.ticlo';
    Fs.writeFileSync(path2, JSON.stringify(jobData));

    let root = new Root();
    root.setLoader(new FileJobLoader('./temp/jobLoaderTest'));

    assert.equal(root.queryValue('job5.value'), 321);
    assert.equal(root.queryValue('job5.subjob.value'), 321);
    assert.deepEqual((root.getValue('job5') as Job).save(), jobData);

    Fs.unlinkSync(path2);
    root.destroy();
  });
});
