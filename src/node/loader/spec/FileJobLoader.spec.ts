import {assert} from 'chai';
import shelljs from 'shelljs';
import Fs from 'fs';
import {Root} from '../../../core/block/Block';
import {shouldHappen, shouldReject, waitTick} from '../../../core/util/test-util';
import {FileJobLoader} from '../FileJobLoader';
import {decode} from '../../../core';

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
    await waitTick(10);
    let savedData = Fs.readFileSync(path, 'utf8');
    assert.equal(savedData, '{\n"#is": ""\n}');

    root.deleteJob('job1');
    await waitTick(10);
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
    await waitTick(15);
    savedData = Fs.readFileSync('./temp/jobLoaderTest/job2.ticlo', 'utf8');
    assert.deepEqual(decode(savedData), {'#is': '', 'value': 456});

    // overwrite delete after write
    job = root.addJob('job3');
    job.applyChange();
    root.deleteJob('job3');
    job = root.addJob('job3');
    root.deleteJob('job3');
    await waitTick(15);
    assert.isFalse(Fs.existsSync('./temp/jobLoaderTest/job3.ticlo'));

    // overwirte delete after delete
    job = root.addJob('job4');
    root.deleteJob('job4');
    job = root.addJob('job4');
    root.deleteJob('job4');
    await waitTick(15);
    assert.isFalse(Fs.existsSync('./temp/jobLoaderTest/job4.ticlo'));

    root.destroy();
  });
  it('init loader', async function() {
    const path = './temp/jobLoaderTest/job5.ticlo';
    Fs.writeFileSync(path, '{"#is":"", "value":321}');

    let root = new Root();
    root.setLoader(new FileJobLoader('./temp/jobLoaderTest'));

    assert.equal(root.queryValue('job5.value'), 321);

    Fs.unlinkSync(path);
    root.destroy();
  });
});
