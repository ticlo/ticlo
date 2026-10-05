import {expect, vi} from 'vitest';
import {Root} from '../../block/Flow.ts';
import {NoSerialize} from '../../util/NoSerialize.ts';
import {Logger} from '../../util/Logger.ts';
import {makeLocalConnection} from '../LocalConnection.ts';
import {AsyncClientPromise} from './AsyncClientPromise.ts';

describe('LocalConnection', () => {
  it('serializes values by default to match remote connections', async () => {
    const root = new Root();
    const flow = root.addFlow('Main');
    const [, client] = makeLocalConnection(root, false);
    try {
      const value = {nested: {count: 1}};
      await client.setValue('Main.value', value, true);
      const saved = flow.getValue('value');
      expect(saved).toEqual(value);
      expect(saved).not.toBe(value);
      const result = await client.getValue('Main.value');
      expect(result.value).toEqual(value);
      expect(result.value).not.toBe(saved);
      expect((await client.getValue('Main')).value).toBeInstanceOf(NoSerialize);
    } finally {
      client.destroy();
      root.destroy();
    }
  });

  it('passes runtime values by reference without serializing trace logs', async () => {
    const root = new Root();
    const flow = root.addFlow('Main');
    const [, client] = makeLocalConnection(root, false, undefined, false);
    const log = vi.fn();
    Logger.add(log, Logger.TRACE);
    class LocalValue {
      toJSON() {
        throw new Error('serialized a local value');
      }
    }
    try {
      const value = new LocalValue();
      await client.setValue('Main.value', value, true);
      expect(flow.getValue('value')).toBe(value);
      expect((await client.getValue('Main.value')).value).toBe(value);
      expect((await client.getValue('Main')).value).toBe(flow);
      const callback = () => 42;
      await client.setValue('Main.callback', callback, true);
      expect((await client.getValue('Main.callback')).value).toBe(callback);
      expect(log).toHaveBeenCalled();
    } finally {
      Logger.remove(log);
      client.destroy();
      root.destroy();
    }
  });

  it.each([true, false])(
    'keeps block previews, bindings and policy after reconnect with serialize=%s',
    async (serialize) => {
      const root = new Root();
      const flow = root.addFlow('Main');
      const child = flow.createBlock('child');
      flow.setBinding('value', 'child');
      const [, client] = makeLocalConnection(root, false, {denyCmds: ['deleteBlock']}, serialize);
      const callbacks = new AsyncClientPromise();
      try {
        client.subscribe('Main.value', callbacks);
        let result = await callbacks.promise;
        expect(result.cache.value).toBeInstanceOf(NoSerialize);
        expect(result.cache.value.type).toBe('Block');
        expect(result.cache.value.value).toBe(child.getFullPath());
        expect(result.cache.bindingPath).toBe('child');

        flow.setValue('source', {block: child, text: '͢:literal'});
        const next = callbacks.promise;
        await client.setBinding('Main.value', 'source', false, true);
        result = await next;
        expect(result.cache.value.block).toBeInstanceOf(NoSerialize);
        if (!serialize) expect(result.cache.value.text).toBe('͢:literal');

        const reconnected = callbacks.promise;
        client.onDisconnect();
        flow.setValue('source', 2);
        result = await reconnected;
        expect(result.cache.value).toBe(2);
        expect(result.cache.bindingPath).toBe('source');
        expect(client.getEditPolicyView().policy).toEqual({denyCmds: ['deleteBlock']});
        const value = {count: 3};
        await client.setValue('Main.source', value, true);
        expect(Object.is(flow.getValue('source'), value)).toBe(!serialize);
        expect(Object.is((await client.getValue('Main.source')).value, value)).toBe(!serialize);
      } finally {
        callbacks.cancel();
        client.destroy();
        root.destroy();
      }
    }
  );
});
