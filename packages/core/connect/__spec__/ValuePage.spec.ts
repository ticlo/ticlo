import {DateTime} from 'luxon';
import {Root} from '../../block/Flow.ts';
import {decode, encode} from '../../util/Serialize.ts';
import {snapshotTransportValue} from '../../util/TransportValue.ts';
import {makeLocalConnection} from '../LocalConnection.ts';
import {readValuePage} from '../ValuePage.ts';

describe('value pages', () => {
  it.each([true, false])('reads complete pages and checks transported anchors (serialize=%s)', async (serialize) => {
    const root = new Root();
    const flow = root.addFlow('Main');
    const items = [
      {first: 'x'.repeat(2000)},
      {block: flow, date: DateTime.utc(2026), binary: new Uint8Array([1, 2])},
      {last: true},
    ];
    flow.setValue('items', items);
    flow.setValue('matrix', {columns: [{name: 'id'}], rows: [[1], [2], [3]]});
    const [, client] = makeLocalConnection(root, false, undefined, serialize, {
      maxMessageSize: 256,
      maxValueSize: 64,
    });
    try {
      const first = await client.getValuePage('Main.items', {offset: 0, limit: 2});
      expect(first.offset).toBe(0);
      expect(first.total).toBe(3);
      expect(first.keys).toEqual(['first', 'last']);
      expect(first.items[0]).toEqual(items[0]);
      // HTTP/WS may serialize an anchor even when a preceding local connection did not.
      const anchor = decode(encode(first.items[1]));
      expect(await client.getValuePage('Main.items', {offset: 2, limit: 2, anchor})).toMatchObject({
        items: [{last: true}],
        offset: 2,
        total: 3,
      });
      expect((await client.getValue('Main.matrix', {select: ['columns']})).value).toEqual([{name: 'id'}]);
      expect(await client.getValuePage('Main.matrix', {select: ['rows'], offset: 0, limit: 2})).toMatchObject({
        items: [[1], [2]],
        offset: 0,
        total: 3,
      });
      expect(await client.getValuePage('Main.missing', {offset: 0, limit: 2})).toMatchObject({
        items: [],
        offset: 0,
        total: 0,
      });
    } finally {
      client.destroy();
      root.destroy();
    }
  });

  it('checks the boundary at its offset, allowing append without a table revision', () => {
    const items = [{id: 1}, {id: 2}, {id: 3}];
    const anchor = snapshotTransportValue(items[1]);
    items.push({id: 4});
    expect(readValuePage(items, {offset: 2, limit: 2, anchor})).toEqual({
      items: [{id: 3}, {id: 4}],
      offset: 2,
      total: 4,
    });
    items[1].id = 3;
    items.push({id: 2});
    expect(readValuePage(items, {offset: 2, limit: 2, anchor})).toBe('page_anchor_mismatch');
    expect(readValuePage(items, {offset: 6, limit: 2, anchor})).toBe('page_anchor_mismatch');
  });

  it.each([
    {offset: -1, limit: 1},
    {offset: 0.5, limit: 1},
    {offset: 0, limit: 0},
    {offset: 0, limit: Infinity},
  ])('rejects invalid ranges %j', (options) => expect(readValuePage([], options)).toBe('invalid page range'));

  it('keeps get permissions and only selects own data', async () => {
    const root = new Root();
    root.addFlow('Main', {allowed: {rows: [[1]]}, secret: [2]});
    const [, client] = makeLocalConnection(root, false, {readonly: true, denyPaths: ['Main.secret']});
    try {
      await expect(client.getValuePage('Main.secret', {offset: 0, limit: 1})).rejects.toBe('restricted path');
      await expect(client.getValue('Main.allowed', {select: ['constructor']})).rejects.toBe('invalid value selection');
      await expect(client.getValue('Main', {select: ['_props']})).rejects.toBe('invalid value selection');
      await expect(client.getValuePage('Main.allowed', {offset: 0, limit: 1})).rejects.toBe('value is not an array');
    } finally {
      client.destroy();
      root.destroy();
    }
  });
});
