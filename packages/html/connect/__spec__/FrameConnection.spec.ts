import {expect} from 'vitest';
import {Block, Root} from '@ticlo/core';
import {AsyncClientPromise} from '@ticlo/core/connect/__spec__/AsyncClientPromise.ts';
import {FrameServerConnection} from '../FrameServerConnection.ts';
import {FrameClientConnection} from '../FrameClientConnection.ts';
import {waitTick} from '@ticlo/core/util/test-util.ts';
import {isDataTruncated} from '@ticlo/core/util/DataTypes.ts';

describe('FrameConnection', function () {
  it.each([128, 4096])(
    'uses server preview limits for postMessage subscriptions (maxValueSize=%s)',
    async (maxValueSize) => {
      const root = new Root();
      const value = 'x'.repeat(1200);
      const items = Array.from({length: 32}, (_, i) => i);
      root.addFlow('Data', {value, items});
      const server = new FrameServerConnection(window, root, {maxMessageSize: 8192, maxValueSize});
      const client = new FrameClientConnection(window, false);
      const values = new AsyncClientPromise();
      const arrays = new AsyncClientPromise();
      try {
        client.subscribe('Data.value', values);
        client.subscribe('Data.items', arrays);
        const preview = (await values.firstPromise).cache.value;
        const arrayPreview = (await arrays.firstPromise).cache.value;
        expect(isDataTruncated(preview)).toBe(maxValueSize === 128);
        expect(isDataTruncated(arrayPreview)).toBe(maxValueSize === 128);
        if (maxValueSize === 4096) {
          expect(preview).toBe(value);
          expect(arrayPreview).toEqual(items);
        }
        expect((await client.getValue('Data.value')).value).toBe(value);
      } finally {
        values.cancel();
        arrays.cancel();
        client.destroy();
        server.destroy();
        root.destroy();
      }
    }
  );

  it('serves readonly requests when the editor starts after the server', async () => {
    const root = new Root();
    const flow = root.addFlow('Main', {value: 1});
    const server = new FrameServerConnection(window, root, {readonly: true});
    let client: FrameClientConnection;
    try {
      await waitTick(20);
      client = new FrameClientConnection(window, false);
      expect((await client.getValue('Main.value')).value).toBe(1);
      await expect(client.setValue('Main.value', 2, true)).rejects.toBe('readonly');
      expect(flow.getValue('value')).toBe(1);
    } finally {
      client?.destroy();
      server.destroy();
      root.destroy();
    }
  });

  it('basic', async function () {
    const flow = Root.instance.addFlow('FrameConnect1');
    const server = new FrameServerConnection(window, Root.instance);
    const client = new FrameClientConnection(window, false);

    flow.setValue('o', 1);
    flow.setBinding('a', 'o');

    const subcallbacks = new AsyncClientPromise();
    client.subscribe('FrameConnect1.a', subcallbacks);
    const result = await subcallbacks.promise;
    expect(result.cache.value).toBe(1);

    // clean up
    subcallbacks.cancel();
    client.destroy();
    server.destroy();
    Root.instance.deleteValue('FrameConnect1');
  });
});
