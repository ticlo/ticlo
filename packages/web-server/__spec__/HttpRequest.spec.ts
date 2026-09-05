import {describe, expect, it} from 'vitest';
import {HonoResponse} from '../HttpRequest.js';

describe('HonoResponse', () => {
  it('sends only the bytes inside a Buffer view', async () => {
    const backing = new ArrayBuffer(16);
    const data = Buffer.from(backing, 5, 3);
    data.set([1, 2, 3]);
    const honoResponse = new HonoResponse();

    honoResponse.send(data);
    const response = await honoResponse.response;

    expect([...new Uint8Array(await response.arrayBuffer())]).toEqual([1, 2, 3]);
  });

  it.each([
    ['a body with a bodyless status', 204, 'body'],
    ['an invalid status', 999, undefined],
  ])('settles with 500 for %s', async (_name, status, data) => {
    const honoResponse = new HonoResponse();

    expect(() => honoResponse.code(status).send(data)).not.toThrow();

    await expect(honoResponse.response).resolves.toMatchObject({status: 500});
  });
});
