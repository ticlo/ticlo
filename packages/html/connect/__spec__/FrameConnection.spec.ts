import {expect} from 'vitest';
import {Block, Root} from '@ticlo/core';
import {AsyncClientPromise} from '@ticlo/core/connect/__spec__/AsyncClientPromise.js';
import {FrameServerConnection} from '../FrameServerConnection.js';
import {FrameClientConnection} from '../FrameClientConnection.js';

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
    expect(result.cache.value).toBe(1);

    // clean up
    subcallbacks.cancel();
    client.destroy();
    server.destroy();
    Root.instance.deleteValue('FrameConnect1');
  });
});
