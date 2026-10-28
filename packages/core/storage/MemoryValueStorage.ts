import type {Storage} from '../block/Storage.ts';
import {StreamDispatcher} from '../block/Dispatcher.ts';

/** Default for detached flows and test runtimes without file storage. */
export class MemoryValueStorage implements Storage {
  private readonly values = new Map<string, string>();
  private readonly streams = new Map<string, StreamDispatcher<string>>();
  async load(key: string) {
    return this.values.get(key) ?? null;
  }
  save(key: string, value: string) {
    this.values.set(key, value);
    this.streams.get(key)?.dispatch(value);
  }
  delete(key: string) {
    this.values.delete(key);
    this.streams.get(key)?.dispatch(null);
  }
  listen(key: string, listener: (value: string) => void) {
    let stream = this.streams.get(key);
    if (!stream) this.streams.set(key, (stream = new StreamDispatcher()));
    stream.listen(listener);
  }
  unlisten(key: string, listener: (value: string) => void) {
    const stream = this.streams.get(key);
    stream?.unlisten(listener);
    if (stream?.isEmpty()) this.streams.delete(key);
  }
}
