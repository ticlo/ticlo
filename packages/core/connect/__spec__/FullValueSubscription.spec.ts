import {describe, expect, it, vi} from 'vitest';
import type {ClientConnection} from '../ClientConnection.ts';
import {SubscribeRequest} from '../ClientRequests.ts';
import {TRUNCATED} from '../../util/DataTypes.ts';

function makeRequest() {
  const reads: PromiseWithResolvers<{value: unknown}>[] = [];
  const getValue = vi.fn(() => {
    const read = Promise.withResolvers<{value: unknown}>();
    reads.push(read);
    return read.promise;
  });
  const conn = {getValue} as unknown as ClientConnection;
  const request = new SubscribeRequest({cmd: 'subscribe', id: 'full', path: 'value'}, 'value', conn);
  const listener = () => ({onUpdate: vi.fn(), onError: vi.fn()});
  return {request, getValue, reads, listener};
}

describe('full-value subscriptions', () => {
  it.each([false, true])('uses complete subscription values without a get (cached=%s)', (cached) => {
    const {request, getValue, listener} = makeRequest();
    const first = listener();
    if (cached) request.onUpdate({value: 'small'});
    request.addFull(first);
    if (!cached) {
      expect(first.onUpdate).not.toHaveBeenCalled();
      expect(getValue).not.toHaveBeenCalled();
      request.onUpdate({value: 'small'});
    }
    expect(first.onUpdate).toHaveBeenCalledExactlyOnceWith({cache: expect.objectContaining({value: 'small'})});

    const second = listener();
    request.addFull(second);
    expect(second.onUpdate).toHaveBeenCalledExactlyOnceWith({cache: expect.objectContaining({value: 'small'})});
    request.onUpdate({undefined: true});
    request.remove(first);
    request.remove(second);
    const third = listener();
    request.addFull(third);
    expect(third.onUpdate).toHaveBeenCalledExactlyOnceWith({cache: expect.objectContaining({value: undefined})});
    expect(getValue).not.toHaveBeenCalled();
  });

  it('shares a truncated-value read and reuses its complete result', async () => {
    const {request, getValue, reads, listener} = makeRequest();
    const first = listener();
    const second = listener();
    request.addFull(first);
    request.onUpdate({value: TRUNCATED});
    request.addFull(second);
    expect(getValue).toHaveBeenCalledExactlyOnceWith('value');
    expect(first.onUpdate).not.toHaveBeenCalled();
    expect(second.onUpdate).not.toHaveBeenCalled();
    reads[0].resolve({value: 'complete'});
    await reads[0].promise;
    for (const subscriber of [first, second]) {
      expect(subscriber.onUpdate).toHaveBeenCalledExactlyOnceWith({
        cache: expect.objectContaining({value: 'complete'}),
      });
    }
    const third = listener();
    request.addFull(third);
    expect(third.onUpdate).toHaveBeenCalledExactlyOnceWith({cache: expect.objectContaining({value: 'complete'})});
    expect(getValue).toHaveBeenCalledTimes(1);
  });

  it.each([false, true])('ignores an outdated read after a newer complete value (failed=%s)', async (failed) => {
    const {request, getValue, reads, listener} = makeRequest();
    const subscriber = listener();
    request.addFull(subscriber);
    request.onUpdate({value: TRUNCATED});
    request.onUpdate({value: 'new value'});
    if (failed) reads[0].reject('old error');
    else reads[0].resolve({value: 'old value'});
    await reads[0].promise.catch(() => {});
    expect(subscriber.onUpdate).toHaveBeenCalledExactlyOnceWith({cache: expect.objectContaining({value: 'new value'})});
    expect(subscriber.onError).not.toHaveBeenCalled();
    expect(getValue).toHaveBeenCalledTimes(1);
  });

  it('reads the latest truncated value after a pending read becomes outdated', async () => {
    const {request, getValue, reads, listener} = makeRequest();
    const subscriber = listener();
    request.addFull(subscriber);
    request.onUpdate({value: `first${TRUNCATED}`});
    request.onUpdate({value: `second${TRUNCATED}`});
    expect(getValue).toHaveBeenCalledTimes(1);
    reads[0].resolve({value: 'first value'});
    await reads[0].promise;
    expect(subscriber.onUpdate).not.toHaveBeenCalled();
    expect(getValue).toHaveBeenCalledTimes(2);
    reads[1].resolve({value: 'second value'});
    await reads[1].promise;
    expect(subscriber.onUpdate).toHaveBeenCalledExactlyOnceWith({
      cache: expect.objectContaining({value: 'second value'}),
    });
  });

  it('invalidates pending reads on subscription errors and waits for a reconnect snapshot', async () => {
    const {request, getValue, reads, listener} = makeRequest();
    const first = listener();
    request.addFull(first);
    request.onUpdate({value: TRUNCATED});
    request.onError('disconnected');
    request.onDisconnect();
    const second = listener();
    request.addFull(second);
    reads[0].reject('disconnected');
    await reads[0].promise.catch(() => {});
    expect(first.onError).toHaveBeenCalledExactlyOnceWith('disconnected', request._data);
    expect(second.onUpdate).not.toHaveBeenCalled();
    expect(second.onError).not.toHaveBeenCalled();
    expect(getValue).toHaveBeenCalledTimes(1);
    request.onUpdate({value: 'reconnected'});
    for (const subscriber of [first, second]) {
      expect(subscriber.onUpdate).toHaveBeenCalledExactlyOnceWith({
        cache: expect.objectContaining({value: 'reconnected'}),
      });
    }
  });
});
