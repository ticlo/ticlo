import {assert} from 'chai';
import {Block, Root} from '../../../../src/core';
import {AsyncClientPromise} from '../../../core/connect/spec/AsyncClientPromise';
import {FrameServerConnection} from '../FrameServerConnection';
import {FrameClientConnection} from '../FrameClientConnection';

describe('FrameConnection', function() {
  it('basic', async function() {
    let job = Root.instance.addJob('FrameConnect1');
    let server = new FrameServerConnection(window, Root.instance);
    let client = new FrameClientConnection(window, false);

    job.setValue('o', 1);
    job.setBinding('a', 'o');

    let subcallbacks = new AsyncClientPromise();
    client.subscribe('FrameConnect1.a', subcallbacks);
    let result = await subcallbacks.promise;
    assert.equal(result.cache.value, 1);

    // clean up
    subcallbacks.cancel();
    client.destroy();
    server.destroy();
    Root.instance.deleteValue('FrameConnect1');
  });
});
