import {assert} from 'chai';
import shelljs from 'shelljs';
import Fs from 'fs';
import {Root} from '../../../core/block/Block';
import {AsyncClientPromise} from '../../../core/connect/spec/AsyncClientPromise';
import {shouldHappen, shouldReject} from '../../../core/util/test-util';
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
    let root = new Root();
    root.setLoader(new FileJobLoader('./temp/jobLoaderTest'));
    let job = root.addJob('job1');
    job.applyChange();
    let savedData = Fs.readFileSync('./temp/jobLoaderTest/job1.ticlo', 'utf8');
    assert.equal(savedData, '{\n"#is": ""\n}');
  });
});
