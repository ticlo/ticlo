import {describe, expect, it} from 'vitest';
import {Root} from '@ticlo/core';
import {RestServerConnection} from '../RestServerConnection.js';

describe('RestServerConnection', () => {
  it('rejects prototype members that are not commands', async () => {
    const root = new Root();
    const connection = new RestServerConnection(root);
    let responseStatus = 200;
    let sent = false;
    const response = {
      send() {
        sent = true;
      },
      status(status: number) {
        responseStatus = status;
        return this;
      },
      header() {
        return this;
      },
    };

    await connection.onHttpPost({body: {cmd: 'constructor'}}, response);

    expect(responseStatus).toBe(400);
    expect(sent).toBe(true);
    connection.destroy();
    root.destroy();
  });
});
