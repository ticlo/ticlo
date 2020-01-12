import {assert} from 'chai';
import shelljs from 'shelljs';
import Fs from 'fs';
import {Root} from '../../../core/block/Block';
import {AsyncClientPromise} from '../../../core/connect/spec/AsyncClientPromise';
import {shouldHappen, shouldReject, waitTick} from '../../../core/util/test-util';
import {initEditor} from '../../../editor';
import {Logger} from '../../../core/util/Logger';
import {addTestTypes, removeTestTypes} from '../../../core/connect/spec/BulkTypes';
import {makeLocalConnection} from '../../../core/connect/LocalConnection';
import {FunctionDesc} from '../../../core/block/Descriptor';
import {Types} from '../../../core/block/Type';
import {FileJobLoader} from '../FileJobLoader';
import {MockWsServer} from '../../connect/spec/MockWsServer';

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

    root.destroy();
  });
  it('init loader', async function() {
    const path = './temp/jobLoaderTest/job2.ticlo';
    Fs.writeFileSync(path, '{"#is":"", "value":321}');

    let root = new Root();
    root.setLoader(new FileJobLoader('./temp/jobLoaderTest'));

    assert.equal(root.queryValue('job2.value'), 321);

    Fs.unlinkSync(path);
    root.destroy();
  });
});
