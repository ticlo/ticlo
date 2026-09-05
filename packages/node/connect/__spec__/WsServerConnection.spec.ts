import {EventEmitter} from 'node:events';
import {describe, expect, it, vi} from 'vitest';
import {Root} from '@ticlo/core';
import {WsServerConnection} from '../WsServerConnection.js';

class MockWebSocket extends EventEmitter {
  send = vi.fn();
}

describe('WsServerConnection', () => {
  it('ignores malformed text frames instead of throwing', () => {
    const root = new Root();
    const socket = new MockWebSocket();
    const connection = new WsServerConnection(socket as any, root);

    expect(() => socket.emit('message', Buffer.from('{invalid json'), false)).not.toThrow();

    connection.destroy();
    root.destroy();
  });
});
