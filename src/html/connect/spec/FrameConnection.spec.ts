import expect from 'expect';
import {Block, Root} from '../../../../src/core';
import {AsyncClientPromise} from '../../../core/connect/spec/AsyncClientPromise';
import {FrameServerConnection} from '../FrameServerConnection';
import {FrameClientConnection} from '../FrameClientConnection';

describe('FrameConnection', function () {
  it('basic', async function () {
    let flow = Root.instance.addFlow('FrameConnect1');
    let server = new FrameServerConnection(window, Root.instance);
    let client = new FrameClientConnection(window, false);

    flow.setValue('o', 1);
    flow.setBinding('a', 'o');

    let subcallbacks = new AsyncClientPromise();
    client.subscribe('FrameConnect1.a', subcallbacks);
    let result = await subcallbacks.promise;
    expect(result.cache.value).toEqual(1);

    // clean up
    subcallbacks.cancel();
    client.destroy();
    server.destroy();
    Root.instance.deleteValue('FrameConnect1');
  });
});
